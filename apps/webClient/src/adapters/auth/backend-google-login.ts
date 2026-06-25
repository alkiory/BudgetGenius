/**
 * Backend-based Google OAuth login for Capacitor native platforms.
 *
 * Instead of using Firebase Auth's signInWithRedirect (which opens the system
 * browser and doesn't return to the app), this flow:
 *   1. Opens the backend's `/api/auth/google` URL in a Chrome Custom Tab
 *      via `@capacitor/browser`.
 *   2. The backend handles the full OAuth flow (via Passport GoogleStrategy),
 *      creates JWT tokens, sets httpOnly cookies, and redirects to
 *      `bgg://auth/success?accessToken=...&refreshToken=...`
 *   3. The custom scheme intent filter opens the app.
 *   4. The `useBackendOAuthReturn` hook (mounted in App.tsx) catches the
 *      `appUrlOpen` event, extracts the tokens, POSTs them to
 *      `/auth/set-cookies` (which sets httpOnly cookies for the API domain
 *      in the WebView's cookie jar), fetches the user profile, and
 *      dispatches `loginAction` + `setAuthReady`.
 *
 * Cookie-based approach:
 *   - The backend's `/auth/set-cookies` endpoint sets httpOnly cookies
 *     for the API domain in the response to a WebView-originated request.
 *   - The WebView's cookie manager stores these cookies for the API domain.
 *   - All subsequent API requests include the cookies (withCredentials: true).
 *   - Token refresh (401 → /auth/refresh) works via the existing axios interceptor.
 *   - Session persists across app restarts because cookies are stored in the
 *     WebView's persistent cookie store.
 */

import {
  loginAction,
  setAuthReady,
  setUser,
} from "@adapters/slices/auth/authSlice";
import { store } from "@adapters/store/rootStore";
import api from "@infrastructure/api.config";
import { isNativePlatform } from "@infrastructure/platform";

/** True when the appUrlOpen listener has received the OAuth redirect. */
let _redirectHandled = false;

/** Tokens extracted from the custom-scheme redirect, shared with the hook. */
let _pendingResolve:
  | ((tokens: { accessToken: string; refreshToken: string }) => void)
  | null = null;
let _pendingReject: ((err: Error) => void) | null = null;

/** Handle for the browserFinished listener, so we can remove it on cleanup. */
let _browserFinishedHandle: { remove: () => void } | null = null;

/**
 * Called by `useBackendOAuthReturn` when the `appUrlOpen` event fires.
 * Marks the redirect as handled (so `browserFinished` doesn't reject),
 * then resolves the pending promise from `initiateCapacitorGoogleLogin`.
 */
export function resolveBackendOAuth(
  tokens: { accessToken: string; refreshToken: string },
): void {
  _redirectHandled = true;
  const resolve = _pendingResolve;
  _pendingResolve = null;
  _pendingReject = null;
  resolve?.(tokens);
}

/**
 * Called by `useBackendOAuthReturn` when the browser tab is closed or the
 * auth flow fails. Rejects the pending promise.
 */
export function rejectBackendOAuth(error: Error): void {
  const reject = _pendingReject;
  _pendingResolve = null;
  _pendingReject = null;
  reject?.(error);
}

/**
 * Resets the internal state. Called on logout or when starting a new
 * login flow.
 */
export function resetBackendOAuthState(): void {
  _redirectHandled = false;
  _pendingResolve = null;
  _pendingReject = null;
  // Remove the browserFinished listener to avoid listener leaks.
  _browserFinishedHandle?.remove();
  _browserFinishedHandle = null;
}

/**
 * Initiates the Google OAuth flow on Capacitor native.
 *
 * Opens the backend's `/api/auth/google` URL in a Chrome Custom Tab via
 * `@capacitor/browser`. The `useBackendOAuthReturn` hook catches the
 * redirect back to `bgg://auth/success`, POSTs the tokens to
 * `/auth/set-cookies`, fetches the user profile, and dispatches auth state.
 *
 * Returns a Promise that resolves once the auth state has been fully
 * set up, or rejects if the user cancels or the flow fails.
 */
export async function initiateCapacitorGoogleLogin(): Promise<void> {
  if (!isNativePlatform()) {
    throw new Error("Backend OAuth login is only available on Capacitor native");
  }

  resetBackendOAuthState();

  // Dynamic imports — these packages only exist in the Capacitor build.
  const { Browser } = await import("@capacitor/browser");

  const apiBaseUrl = api.defaults.baseURL || "";

  return new Promise<void>((resolve, reject) => {
    // Store the resolve/reject for the hook to call.
    _pendingResolve = (tokens) => {
      setCookiesAndDispatch(tokens).then(resolve).catch(reject);
    };
    _pendingReject = (err) => {
      reject(err);
    };

    // Set up the browser-closed listener BEFORE opening the tab to
    // avoid a race condition. Only reject if the redirect hasn't been
    // handled yet (the `_redirectHandled` flag is set by
    // `resolveBackendOAuth` when the hook receives the appUrlOpen event).
    Browser.addListener("browserFinished", () => {
      if (!_redirectHandled) {
        rejectBackendOAuth(new Error("Google login cancelled"));
      }
    }).then((handle) => {
      _browserFinishedHandle = handle;
    });

    // Open the backend OAuth URL in a Chrome Custom Tab.
    Browser.open({ url: `${apiBaseUrl}/auth/google` });
  });
}

/**
 * After receiving tokens from the OAuth redirect:
 *   1. POST them to `/auth/set-cookies` so the backend sets httpOnly
 *      cookies for the API domain in the WebView's cookie jar.
 *   2. Close the Chrome Custom Tab.
 *   3. Fetch the user profile to populate the auth slice.
 *   4. Dispatch `loginAction` + `setAuthReady`.
 */
async function setCookiesAndDispatch(tokens: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  // POST tokens to the backend, which sets httpOnly cookies for the API
  // domain. The WebView's cookie manager stores these cookies, and they'll
  // be sent with all subsequent API requests (withCredentials: true).
  try {
    await api.post("/auth/set-cookies", {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (err) {
    console.error("Failed to set cookies via backend:", err);
    // Non-fatal: the Authorization header fallback below still works.
  }

  // Belt-and-suspenders: set the Authorization header for immediate use.
  // If the cookie Set-Cookie from the POST response isn't applied quickly
  // enough for the subsequent /user/profile request, the Authorization
  // header guarantees the request is authenticated.
  api.defaults.headers.common.Authorization = `Bearer ${tokens.accessToken}`;

  // Close the Chrome Custom Tab if it's still open.
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch {
    // Browser plugin unavailable or already closed — ignore.
  }

  // Fetch user profile to populate the auth slice.
  try {
    const profileResp = await api.get("/user/profile", { _retry: true });
    const profile = profileResp?.data;
    if (profile) {
      store.dispatch(setUser(profile));
    }
  } catch {
    // Profile fetch is non-fatal; cookies/Authorization are already set.
  }

  store.dispatch(loginAction());
  store.dispatch(setAuthReady());
}

/**
 * Clears the auth state on logout.
 */
export async function clearCapacitorAuth(): Promise<void> {
  resetBackendOAuthState();
  delete api.defaults.headers.common.Authorization;
}
