import { logoutAction } from "@adapters/slices/auth/authSlice";
import {
  ACCESS_TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
} from "@infrastructure/api.config";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Minimum-shape `Dispatch` type that matches Redux Toolkit's runtime
 * dispatcher for the actions this helper fires. We deliberately do
 * NOT `import type { Dispatch } from "redux"` because the webClient
 * does not depend on the `redux` core types package (only
 * `@reduxjs/toolkit`, which re-exports `Dispatch` indirectly). The
 * inline shape covers `logoutAction` and any future action creator
 * the helper may augment — we dispatch a single action object and
 * rely on the toolkit's Immer + middleware chain for the reducers.
 */
type Dispatch = (action: { type: string; payload?: unknown }) => unknown;

/**
 * SessionStorage key updated by `apps/webClient/src/presentation/pages/splash.tsx`
 * when the splash has shown on the latest native mount. We clear it as part
 * of the logout cleanup so the NEXT mount does NOT see a stale "already
 * shown" flag and skip the splash; that skip caused the v1.7.2 regression
 * where the leading /auth/login render after a delete-as-logout was empty
 * on the Android WebView (the splash ran, decided nothing, and the Auth
 * layout had not yet mounted, leaving the user on a transient white screen).
 */
const SPLASH_SHOWN_SESSION_KEY = "mobile.splash.shown";

/**
 * Centralised post-logout / post-delete state cleanup. Replaces the
 * five independent call sites that previously dispatched
 * `logoutAction` without touching the surrounding caches — leading to
 * the v1.7.2 delete-account regression where the danger-zone button
 * was a 2-second `setTimeout` placeholder that never called the backend
 * DELETE, and the surrounding React Query / Redux / localStorage state
 * lingered so a re-login as the same email authenticated as an existing
 * user (no onboarding, stale per-user data).
 *
 * Side-effect ORDER is load-bearing and codified in `knowledge.md
 * §6.8.5`:
 *
 *   1. `localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY)`
 *      — must run BEFORE anything else. The api.config.ts response
 *        interceptor persists tokens to localStorage on every successful
 *        auth response. A background response that lands AFTER the
 *        helper runs would otherwise re-persist them while the cache
 *        is being cleared. We try/catch because incognito / sandboxed
 *        contexts throw on `removeItem`.
 *
 *   2. `sessionStorage.removeItem(SPLASH_SHOWN_SESSION_KEY)` — so the
 *      next mount re-shows the splash as a clean boot. try/catch.
 *
 *   3. `queryClient.clear()` — evict EVERY React Query cache entry.
 *      Without this, `useGetSettings()`'s cached
 *      `{ hasCompletedOnboarding: true }` pollutes the fresh user's
 *      onboarding gate.
 *
 *   4. `dispatch(logoutAction())` — last so the slice re-evaluation
 *      sees the cleared slices. `authSlice.isAuthenticated` flips to
 *      `false`, `authSlice.user` clamps to `null`, and the next
 *      `<AuthGuard>` mount's `if (!isAuthenticated && !user) return
 *      <Navigate to=/auth/login>` triggers, redirecting away from any
 *      `/app/*` route that the surrounding React tree was holding open.
 *
 * The user-facing commit on `dispatch(logoutAction())` is synchronous
 * and reference-stable (Redux Toolkit + Immer preserves slice identity
 * until a reducer mutates a path the next selector reads). Coupled
 * with the cleared React Query cache, the OnboardingGuard's
 * strict-positive `settings?.hasCompletedOnboarding !== true` (§6.8.3)
 * gate directs the next mount to `/app/onboarding` cleanly.
 *
 * Use from `account-settings.tsx#handleDeleteAccount.onSuccess` AND
 * from the regular-logout paths in `dashboard/sidebar.tsx` and
 * `session-expired-modal.tsx`. Do NOT re-implement the side-effects
 * locally; that creates the §6.8.5 drift class the code-reviewer
 * flags.
 *
 * @param dispatch   Redux dispatcher from `useDispatch()`. Required.
 * @param queryClient React Query client from `useQueryClient()`.
 *                   Required; passing `null` is a programmer error.
 */
export function clearAuthAndStateForLogout(
  dispatch: Dispatch,
  queryClient: QueryClient,
): void {
  if (!queryClient) {
    // Defense-in-depth — vitest mocks `undefined` for `useQueryClient`'s
    // return value if a caller forgets to wrap in a QueryClientProvider.
    // Refusing to proceed without a cache to clear avoids leaving
    // orphan entries in place.
    throw new Error(
      "clearAuthAndStateForLogout requires a live QueryClient. " +
        "Wrap your component in <QueryClientProvider> at app boot.",
    );
  }

  // Side-effect 1: long-lived tokens in localStorage. try/catch for
  // incognito / sandboxed contexts where `removeItem` throws.
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    /* incognito / sandboxed contexts */
  }

  // Side-effect 2: per-session splash flag. try/catch for the same
  // reason.
  try {
    window.sessionStorage.removeItem(SPLASH_SHOWN_SESSION_KEY);
  } catch {
    /* ignore */
  }

  // Side-effect 3: clear every React Query entry. `queryClient.clear()`
  // is the spine of the helper — without it, the next mount inherits
  // the previous user's data. The fresh-user invariant on the
  // onboarding gate (knowledge.md §6.8.3 strict-positive) requires
  // this; the gate's `useGetSettings()` reads from React Query and
  // would otherwise serve stale `hasCompletedOnboarding: true`.
  queryClient.clear();

  // Side-effect 4: dispatch LAST. This flips authSlice.isAuthenticated
  // to false and clears authSlice.user, so AuthGuard's next render's
  // `if (!isAuthenticated && !user) return Navigate(/auth/login)`
  // fires the redirect cleanly. We dispatch AFTER the synchronous
  // cache clears so any selector reading both slices sees a coherent
  // "everything-purged" state.
  dispatch(logoutAction());
}
