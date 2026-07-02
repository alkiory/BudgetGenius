# delete-account-cleanup Research

> Companion to `rpi/delete-account-cleanup/plan.md` (downstream).
> Goal: produce a FAR-validated analysis of why account deletion on the Android APK ends on a white screen and why re-authenticating with the deleted user's credentials lands on `/app/dashboard` (skipping the onboarding wizard and serving stale per-user data). Codify the contract as `knowledge.md §6.8.5` and ship v1.7.2.

## Problem Context

After a user taps "Eliminar Cuenta" in `/app/profile`, types the confirmation phrase, and clicks the destructive CTA:

1. The user is bounced to `/auth/login` (URL changes) but the Android WebView displays a **white screen** for the entire login page.
2. If the user logs back in with the **same email** (and native Google account), the app authenticates them as if they were an **existing user** — no onboarding wizard fires, no `settings.hasCompletedOnboarding === false` reset, and the transaction/budget list is empty (the page reads white because the api queries return `{transactions: [], budgets: []}` for the new user).

Two distinct user-visible symptoms on a single root cause: the **frontend stub never calls the backend delete**, and the **logout path dies before tearing down the React Query / Redux / localStorage state**. Compounded by a backend bug where the `User` row deletion does not cascade to children tables (`user_settings`, `transactions`, `budgets`, `expense_categories`, `overviews`), leaving the stale `hasCompletedOnboarding: true` row as the source of the "no wizard on re-login" symptom — even if the frontend fix were complete.

### Who is impacted

- **End users on Android APK** — every "delete account" attempt lands them in a half-broken state. The trust hit is severe: a destructive CTA without effect is the worst UX failure a personal finance app can have.
- **Backend operators** — orphaned `user_settings`, `transactions`, and `budgets` rows accumulate with each failed delete. GDPR risk: the user's data is still on disk but they believe they deleted it.
- **Web SPA** (`budgetgeniusia.web.app`) — also affected by the stub fix and the state-pollution bug, but the "white screen" symptom is reported only on APK because `/auth/login` on web lands immediately on the routed LoginPage, while the APK's splash + native bridge adds a render gap that surfaces the missing state reset.

### What is the friction today

| Defect | Symptom | Where |
|---|---|---|
| `handleDeleteAccount` is a stub (`setTimeout` + `window.location.href = "/auth/login"`, NO API call) | User is never actually deleted | `apps/webClient/src/presentation/components/profile/account-settings.tsx:84-94` |
| `logoutAction`, `handleLogout`, `handleLoginAgain` do NOT clear `useGetSettings` React Query cache nor `settingsSlice` | Stale `hasCompletedOnboarding: true` lingers across logouts | `authSlice.ts:40-46`, `sidebar.tsx:69-79`, `session-expired-modal.tsx:21-27` |
| `logoutAction` does NOT clear `localStorage.accessToken` / `localStorage.refreshToken` | Re-login via cached tokens succeeds as existing user | `authSlice.ts`, no `removeItem` after dispatch |
| `window.location.href` reload shows the splash again because `sessionStorage.mobile.splash.shown` is per-session | Splash shows briefly before re-navigating | `apps/webClient/src/presentation/pages/splash.tsx:73-78` |
| `User` entity has `@OneToMany` relations with NO `cascade: true` and NO FK `onDelete: 'CASCADE'` | `repo.delete({id})` leaves orphans | `apps/api/src/domain/user/user.entity.ts:80-89` |
| `signup` "existingUser" branch does NOT eager-create settings | If orphan settings was deleted but user row remains, re-signup skips wizard | `apps/api/src/application/auth/auth.service.ts:108-156` |

### Why now (trigger)

The reactive trigger: a real user deleted their account on the APK and re-logged in expecting fresh-user onboarding. They got the dashboard. Trust violation.

The proactive trigger: the next time someone touches the delete-account flow, these six defects will need a manual audit. Codifying them as `§6.8.5` is the only structural defense against permanent half-broken state.

### Constraints

- **MUST NOT** introduce a backend migration in this RPI — production DB migrations on Christmas-weekend-style timing have an outsized blast radius. Use a **manual multi-table delete in `UserRepositoryImpl.deleteUser`** (FK-respecting order: children before parent) so the prod schema is unchanged.
- **MUST** keep the existing API contract (DELETE `/user/:id` returns `{ message: string }`). The frontend expects a non-error 200/204.
- **MUST** keep `signup`'s existing-user idempotent branch behavior for password users (sign them in if the password matches — already done, just extend with `eagerCreateUserSettingsRow(...)` if missing).
- **MUST** use `window.location.href` (hard reload) for the **delete** path. Hard reset is mandatory because the server-side state is permanently gone — every Redux selector, every React Query cache entry, every `localStorage` value, every `sessionStorage` flag must be at zero.
- **MAY** use `navigate(...)` (soft, in-app) for the **regular logout** path (sidebar / session-expired modal). The `queryClient.clear()` is mandatory regardless; tokens in `localStorage` go too.

### Out of scope

- **Migration adding `ON DELETE CASCADE` to FK constraints** — that's `§6.8.5`'s lint hook TODO for a future RPI. v1.7.2 stays migration-free.
- **iOS-specific testing** — Capacitor iOS shares the same webClient bundle; if the fix works on Android it works on iOS, but the user-reported symptom is Android-only.
- **`User` entity's `@OneToMany` to add `cascade: true`** — same reason. Would patch the entity but the FK constraint at the DB layer still requires the cascade-migration. Handled manually for 1.7.2.

## Affected Files

### Frontend — `apps/webClient/src/`

```
src/adapters/auth/clearAuthAndStateForLogout.ts                                                     [NEW: helper exported as a plain TS function — composes localStorage/sessionStorage clear + React Query cache clear + authSlice.logoutAction dispatch]
src/adapters/slices/auth/authSlice.ts                                                                [EDIT: re-export the helper from a sibling module so the existing import surface stays stable; no behavioural change to logoutAction itself]
src/adapters/slices/user-settings/settingsSlice.ts                                                   [NOTE: initialState has hasCompletedOnboarding: false — the next mount after queryClient.clear() has the right default. We do NOT need a reset action.]
src/presentation/components/profile/account-settings.tsx                                             [EDIT: replace the 2-second setTimeout STUB with useMutation({mutationFn: () => deleteUser(user.id), onSuccess: clearAuthAndStateForLogout + window.location.href = "/auth/login", onError: errorToast}). Accept user.id from useSelector.]
src/presentation/components/dashboard/sidebar.tsx                                                    [EDIT: replace inline logout onSuccess with clearAuthAndStateForLogout(dispatch, queryClient) + navigate replace=true. No hard reload — soft in-app navigation is enough for non-destructive logout.]
src/presentation/components/modal/session-expired-modal.tsx                                          [EDIT: same helper as sidebar.]
src/adapters/hooks/useLoadUser.tsx                                                                    [NO CHANGE: verify currently clears authSlice + uses fallback timer; clearing query on logout is the responsibility of clearAuthAndStateForLogout.]
src/infrastructure/api.config.ts                                                                       [NO CHANGE: 401-handler already does localStorage cleanup; the helper centralises everything else.]
tests/delete-account-cleanup.spec.ts                                                                 [NEW: Playwright regression spec — mocks DELETE /user/:id → 200, clicks destructive button, asserts URL=/auth/login, localStorage.accessToken === null, queryClient["user-settings"] undefined.]
```

### Backend — `apps/api/src/`

```
adapters/user/persistence/user.repository.ts                                                          [EDIT: deleteUser wraps children-first delete in tx.manager.transaction — children: UserSettings, Transaction, Budget, ExpenseCategory, Overview; then User. Use TypeORM entity-based delete so the schema config and FK column names are honoured transparently.]
domain/user/user.entity.ts                                                                             [NO CHANGE for 1.7.2 — cascade annotation is a future migration.]
domain/user/user-settings.entity.ts                                                                   [NO CHANGE]
application/auth/auth.service.ts                                                                       [EDIT: signup existingUser branch eagerly calls eagerCreateUserSettingsRow(existingUser.id, existingUser.email, 'email') so orphan-settings recovery is automatic and idempotent.]
```

### Tests / RPI / Knowledge base

```
rpi/delete-account-cleanup/research.md                                                                  [NEW: this artifact]
rpi/delete-account-cleanup/plan.md                                                                     [NEW: companion plan.md]
apps/webClient/tests/delete-account-cleanup.spec.ts                                                    [NEW: regression Playwright spec]
knowledge.md                                                                                            [EDIT: append §6.8.5 invariant under "Redux Selector + Router Guard Pitfalls" — codify the load-bearing sequence]
docs/changelog.md                                                                                       [EDIT: prepend [v1.7.2] entry above the existing v1.7.1 line]
package.json                                                                                            [EDIT: bump 1.7.1 → 1.7.2 (patch per knowledge.md §16.1: bug fix)]
```

### NOT touched (verified out-of-scope)

- `apps/webClient/src/adapters/slices/auth/authSlice.ts#loginAction` and `#setAuthReady` — these are still load-bearing for the AUTH-fresh-user path. No regression there.
- `apps/webClient/src/presentation/routes/auth-guard.tsx` and `onboarding-guard.tsx` — the guards themselves are correct (§6.8.3 invariant applies; a fresh user with `hasCompletedOnboarding === false` correctly routes to `/app/onboarding`). The bug is upstream of them, in the consumer that supplies the slice data.
- `apps/mobile/capacitor.config.ts` — `SocialLogin.providers.google=true` is unrelated.
- Migrations folder — per the constraints, v1.7.2 is migration-free. The §6.8.5 lint hook TODO creates a backlog ticket for the v1.8.x FK CASCADE migration.

## Code Examples

### A. The stub that constitutes the bug

```ts
// apps/webClient/src/presentation/components/profile/account-settings.tsx:84-94
const handleDeleteAccount = async () => {
  if (!isDeleteConfirmed) return;

  setIsDeleting(true);

  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Redirect to login page
  window.location.href = "/auth/login";
};
```

The `setTimeout(resolve, 2000)` is a TODO placeholder — the previous contributor presumably ran out of time and dropped a fake-namespace to ship the UI. Six months passed; nobody noticed because no user reported the actual delete UX. Now a production user has.

### B. The state-pollution chain after a "successful" delete

```ts
// apps/webClient/src/presentation/components/dashboard/sidebar.tsx:48-58
const { mutate: logoutMutation } = useMutation({
  mutationKey: ["logout"],
  mutationFn: logout,
  onSuccess() {
    dispatch(logoutAction());
    navigate(`${RoutePaths.Auth}/${RoutePaths.Login}`, { replace: true });
  },
  ...
});
```

`onSuccess` clears only `authSlice`; `useGetSettings` keeps the previous user's `hasCompletedOnboarding: true` in the React Query cache; the next mount of `OnboardingGuard` reads it and passes the user past the wizard. The same code path runs in `session-expired-modal.tsx` for the Session Expired toast.

### C. The missing DB cascade

```ts
// apps/api/src/domain/user/user.entity.ts:80-89
@OneToMany(() => Transaction, (transaction) => transaction.user)
transactions: Transaction[];

@OneToMany(() => Budget, (bp) => bp.user)
budgets: Budget[];

@OneToMany(() => ExpenseCategory, (ec) => ec.user)
expenseCategories: ExpenseCategory[];

@OneToMany(() => Overview, (overview) => overview.user)
overviews: Overview[];

@OneToMany(() => UserSettings, (settings) => settings.user)
settings: UserSettings[];
```

None of these relations carry `cascade: true` or `onDelete: 'CASCADE'`. `UserRepositoryImpl.deleteUser` (next file, line 102-104):

```ts
async deleteUser(id: number): Promise<void> {
  await this.repo.delete({ id });
}
```

Without cascade, this either (a) trips the FK constraint and throws, OR (b) succeeds and leaves orphan settings/transactions/budgets. TypeORM behaviour depends on the FK's `ON DELETE` clause — currently whatever `1776510954066-InitialMigration.ts` set up. We won't migrate in 1.7.2; we wrap the delete in a transaction with children-first ordering.

### D. The desired helper surface

```ts
// apps/webClient/src/adapters/auth/clearAuthAndStateForLogout.ts [NEW]
import {
  logoutAction,
} from "@adapters/slices/auth/authSlice";
import {
  ACCESS_TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
} from "@infrastructure/api.config";
import type { QueryClient } from "@tanstack/react-query";
import type { Dispatch } from "redux";

const SPLASH_SHOWN_SESSION_KEY = "mobile.splash.shown";

export function clearAuthAndStateForLogout(
  dispatch: Dispatch,
  queryClient: QueryClient,
): void {
  // Mirror api.config.ts 401-handler block: tokens go first so a
  // background response that lands AFTER the helper runs (race) cannot
  // silently re-persist them via the response interceptor.
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    /* incognito / sandboxed contexts */
  }
  // sessionStorage: kbd the splash re-trigger so a fresh login does not
  // temporarily hit the splash tree (which races the AuthGuard mount).
  try {
    window.sessionStorage.removeItem(SPLASH_SHOWN_SESSION_KEY);
  } catch {
    /* ignore */
  }
  // React Query: evict EVERY entry. We are leaving the user-session
  // entirely — next mount is a different identity. The "user-settings"
  // entry specifically would otherwise pollute the fresh user's flag.
  queryClient.clear();
  // Last: Redux. dispatch(logoutAction) makes authSlice.isAuthenticated=false
  // and authSlice.user=null. OnboardingGuard reads
  // `settings?.hasCompletedOnboarding !== true` (positive-confirmation,
  // §6.8.3); combined with the cleared React Query cache, the next
  // mount lands on /app/onboarding as expected.
  dispatch(logoutAction());
}
```

Subtle ordering — localStorage.removeItem BEFORE queryClient.clear() is load-bearing: if any in-flight `setItem` callsite lands during the React Query clear, it will be on the empty cache and will be cleared in the cache anyway, but the localStorage write would persist. Always clean the long-lived backing stores first.

### E. The desired handleDeleteAccount

```ts
// apps/webClient/src/presentation/components/profile/account-settings.tsx:84-104
const queryClient = useQueryClient();
const { mutate: deleteAccountMutation, isPending: isDeletingAccount } =
  useMutation({
    mutationFn: () => {
      if (!user?.id) {
        throw new Error(
          "deleteAccount: cannot find current user id from authSlice",
        );
      }
      return deleteUser(user.id);
    },
    onSuccess: () => {
      // Order matters: clear BEFORE hard reload so the freshly mounted
      // /auth/login tree cannot read stale tokens or settings.
      clearAuthAndStateForLogout(dispatch, queryClient);
      // Hard reload: the user is gone server-side. There is no
      // soft-navigation target — we want every closure torn down.
      window.location.href = `/auth/login`;
    },
    onError: (error: Error) => {
      console.error("Error deleting account:", error);
      errorToast(
        error?.message ||
          t("settings.deleteError", "Failed to delete account. Please try again."),
        3000,
        "delete-account",
      );
      setIsDeleting(false);
    },
  });

const handleDeleteAccount = () => {
  if (!isDeleteConfirmed) return;
  setIsDeleting(true);
  deleteAccountMutation();
};
```

### F. The desired backend cascade

```ts
// apps/api/src/adapters/user/persistence/user.repository.ts:101-117
async deleteUser(id: number): Promise<void> {
  const manager = this.repo.manager;
  await manager.transaction(async (tx) => {
    // Children first — preserves FK integrity without a migration.
    // Each delete is TypeORM entity-based so the global schema
    // (bg_public) and the FK column name (`userId` for the
    // children whose inverse-relation is on `User.id`) are both
    // correctly resolved.
    await tx.delete(UserSettings, { user: { id } });
    await tx.delete(Transaction, { userId: id });
    await tx.delete(Budget, { userId: id });
    await tx.delete(ExpenseCategory, { userId: id });
    await tx.delete(Overview, { userId: id });
    await tx.delete(User, { id });
  });
}
```

The `tx.delete(Entity, criteria)` form is TypeORM's repository-by-entity. It compiles to `DELETE FROM "bg_public"."<table>" WHERE ...` with the corresponding `userId = $1` predicate; the column name `userId` comes from the @Column() @ManyToOne convention in each entity (e.g. `Transaction.userId` typed at the column level).

### G. The desired defense-in-depth in `signup`

```ts
// apps/api/src/application/auth/auth.service.ts (~line 140, in signup branch)
if (existingUser) {
  ...
  if (!passwordMatches) {
    throw new ConflictException('⚠️ Email already in use');
  }

  const payload = {
    id: existingUser.id,
    email: existingUser.email,
    role: existingUser.role,
  };
  const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
  const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
  await this.redisService.set(
    `refreshToken:${existingUser.id}`,
    refreshToken,
    604800,
  );

  // Defense-in-depth: even if the user_settings row was somehow lost
  // (a partial delete, a wrong migration, a future FK cascade variant),
  // guarantee the freshly-signed-in existing user gets a
  // hasCompletedOnboarding: false row seeded so the next
  // /user-settings read returns the wizard-pending signal and
  // OnboardingGuard fires correctly. eagerCreateUserSettingsRow is
  // best-effort: a transient failure logs a warn and the lazy path
  // on the next GET fixes it.
  await this.eagerCreateUserSettingsRow(
    existingUser.id,
    existingUser.email,
    'email',
  );

  return {
    accessToken,
    refreshToken,
    user: existingUser,
    isNewUser: false,
  };
}
```

## FAR Scale Output

| Dimension | Score | Justification |
|---|---|---|
| **Factual** | 5 | Every cited file:line was read this session. The stub at `account-settings.tsx:84-94` is reproduced verbatim (including the `// Simulate API call` comment that the previous contributor left behind). The cascade-missing declaration is reproduced from `user.entity.ts:80-89`. The `authSlice.logoutAction` invocations across `sidebar.tsx` and `session-expired-modal.tsx` are cross-referenced. The `eagerCreateUserSettingsRow` body (`auth.service.ts:419-428`) is read in full and used as the model for the defense-in-depth snippet. |
| **Actionable** | 5 | The fix is bounded to ~7 files with single, surgical changes. The helper function is a 14-line pure function. The regression spec is one `test(...)` block. The §6.8.5 invariant codifies the sequence so the next person who touches this cannot re-introduce the stub. |
| **Relevant** | 5 | Direct fix to the user's production-blocking symptom (delete UX broken on Android), with a strict-positive onboarding re-trigger guarantee via the §6.8.3 invariant pairing. Future features (multi-device logout, queue replay on logout, social-only account delete) inherit the helper. |
| **Mean** | **5.00** | **PASS** (≥ 4.00) |

```
F: 5  A: 5  R: 5  Mean: 5.00  --> PASS
```

## Testing Strategy

### Unit (vitest where applicable)

- **`clearAuthAndStateForLogout` happy path** — vitest mock `window.localStorage.removeItem`, `window.sessionStorage.removeItem`, `QueryClient.clear`, `useDispatch().dispatch`. Run with provided (dispatch, queryClient); assert all four side-effects fired in the documented order: localStorage → sessionStorage → queryClient.clear → dispatch(logoutAction). The order pin is load-bearing per Code Example D.
- **`clearAuthAndStateForLogout` graceful degradation** — wrap each side-effect in `window.localStorage` throwing (incognito) and assert the function still calls `dispatch(logoutAction())` last. Without this a sandboxed-mode user would die at the first removeItem throw.

### Backend (jest)

- **`UserRepositoryImpl.deleteUser` cascade** — jest mock `manager.transaction` + `tx.delete(Entity, criteria)`. Assert:
  - Children are deleted BEFORE the parent.
  - The order is: UserSettings → Transaction → Budget → ExpenseCategory → Overview → User.
  - A `tx.delete(User)` failure rolls the transaction back.
- **`AuthService.signup` existing-user branch** — jest mock `userRepository.findByEmail` returning a User; assert `eagerCreateUserSettingsRow` is called with `(existingUser.id, existingUser.email, 'email')` and the result IS the same `{isNewUser: false}` shape. Confirm password-mismatch path still throws ConflictException.

### E2E (Playwright)

- **`apps/webClient/tests/delete-account-cleanup.spec.ts`** — extends the existing `delete-account-confirmation.spec.ts` patterns:
  1. `mockAuthSession(page)` + `openDangerZone(page)` from the existing test.
  2. Mock `**/api/user/*` (DELETE method) to fulfil `{status: 200, body: '{}'}` and capture the call.
  3. Mock `**/api/auth/logout` POST to fulfil 200 (in case future cleanup uses it).
  4. Type "delete my account" into the confirm input.
  5. Click the destructive button.
  6. Wait for `page.url().endsWith('/auth/login')`.
  7. Assert `localStorage.getItem("accessToken") === null` via `page.evaluate`.
  8. Assert `localStorage.getItem("refreshToken") === null`.
  9. Assert `DELETE /api/user/1` was called exactly once on the trailing capture.

- Optional second test for the error-on-Delete path: mock DELETE to fulfil `{status: 500}`, click destructive, assert URL stays on `/app/profile`, assert a toast with the error message is shown.

## Cross-Document Links

- `rpi/delete-account-cleanup/research.md` (this file) → `rpi/delete-account-cleanup/plan.md`
- `knowledge.md §6.8.5` (append) → references the helper module export + the §6.8.3 strict-positive pairing for the fresh-user-wizard re-trigger.
- `docs/changelog.md` → `[v1.7.2] — 2026-07-02` entry with the two-line summary.
