import axios from "axios";
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import toast from "react-hot-toast";
// Internal imports grouped in alphabetical order per the
// project's `import/order` eslint rule.
import { getDeviceId } from "./device-id";
import { enqueueRequest, registerOnlineListener } from "./offline-queue";
import { requestQueue } from "./request-queue";

interface ApiError {
  config: AxiosRequestConfig & {
    _retry?: boolean;
    _retryCount?: number;
  };
  response?: AxiosResponse;
}

const base = import.meta.env.VITE_API_URL as string;

const headers: Record<string, string> = {
  "Content-Type": "application/json",
};

// Configuración de Axios
const api = axios.create({
  baseURL: base,
  headers,
  withCredentials: true,
});

// Register online listener to flush the offline queue when connectivity returns
registerOnlineListener(api);

/** Status codes that indicate the backend is unreachable (e.g., Vite proxy returning 502). */
const PROXY_UNAVAILABLE_CODES = [502, 503, 504];

// ──────────────────────────────────────────────────────────────────────
// v1.3.0 — body + Authorization fallback for Capacitor Android WebView.
//
// Android System WebView (Chrome-based) silently drops Set-Cookie from
// cross-origin responses (third-party cookie policy). The bug surfaces
// in the `/auth/firebase-login` => `/api/...` round-trip: the cookie
// never reaches WebView's jar, so /auth/refresh (which reads
// `req.cookies.refreshToken`) returns 401 even though the JWT access
// token is technically valid for the next 30 minutes.
//
// Defense-in-depth: backend now returns `{accessToken, refreshToken,
// user, message}` in the body of every successful auth response
// (see `apps/api/src/adapters/auth/http/auth.controller.ts`),
// AND `/auth/refresh` also accepts the refresh token via body +
// `Authorization: Bearer ...` header (same contract as accessToken's
// JWT strategy in `apps/api/src/infrastructure/config/strategy/jwt.strategy.ts`).
// The mirror here is:
//   1. **Response interceptor** — on every successful auth response,
//      persist `data.accessToken` + `data.refreshToken` to BOTH
//      `localStorage` (web storage; survives reloads) AND the
//      browser's cookie jar via `document.cookie` (so the same-site
//      cookie path keeps working on web SPA and the Capacitor path
//      that hasn't blocked cookies yet).
//   2. **Request interceptor** — attach `Authorization: Bearer
//      ${localStorage.accessToken}` so the backend's auth pipeline
//      works even if cookies were dropped. Backend already allowlists
//      `Authorization` in CORS (`apps/api/src/main.ts:99`).
//   3. **`X-Device-Id`** — emit a per-install stable id (generated
//      on first load via `crypto.randomUUID` or `getRandomValues`,
//      persisted in `localStorage.bgDeviceId`). Backend's
//      `ThrottlerModule.getTracker` reads this header FIRST in
//      priority order, so a shared-public-IP situation (mobile CGNAT)
//      does not fold into one bucket.
//   4. **refresh()** — sends `refreshToken` in the body so the
//      `/auth/refresh` Body contract works regardless of cookie
//      survival. Backend reads cookie → body → Authorization header
//      in priority order.
// See `rpi/mobile-cookies-persistence/` for the full RPI artifacts.
// ──────────────────────────────────────────────────────────────────────

const STORAGE_KEY_ACCESS = "accessToken";
const STORAGE_KEY_REFRESH = "refreshToken";

/**
 * Persist the token pair to localStorage only.
 *
 * Why no JS-side `document.cookie` write: the server's response ALSO
 * sets the cookie via `Set-Cookie` with the prod shape
 * (`HttpOnly; Secure; SameSite=None`); a JS-side `SameSite=Lax`
 * cookie for the same name would create a SameSite desync where the
 * browser keeps one cookie and ignores the other. Since v1.3.1, the
 * server is the single source of truth for the cookie channel;
 * localStorage is the source of truth for the body / Authorization
 * channel. Trying to write both from the JS side is a bug magnet.
 */
function persistTokens(accessToken: string, refreshToken: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_ACCESS, accessToken);
    window.localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
  } catch {
    // localStorage may throw in incognito / sandboxed contexts —
    // the server's Set-Cookie still covers the same-site browser
    // path; nothing else we can do here at boot time.
  }
}

/**
 * Pull the persisted tokens back out for the Authorization header +
 * /auth/refresh request body.
 */
function readPersistedTokens(): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  try {
    accessToken = window.localStorage.getItem(STORAGE_KEY_ACCESS);
    refreshToken = window.localStorage.getItem(STORAGE_KEY_REFRESH);
  } catch {
    // ignore — see persistTokens() comment
  }
  return { accessToken, refreshToken };
}

// ── Request interceptor: attach Authorization + X-Device-Id ────────
//
// Registered BEFORE the response interceptor so every outbound
// request picks up the headers. The `_retry` flag suppresses the
// Authorization header when retrying a request that already failed
// (the request headers are computed fresh from current localStorage
// state, so a successful _retry_ doesn't re-emit a stale token).
api.interceptors.request.use((config) => {
  try {
    // v1.3.0 (mobile-cookies-persistence review-note §6): skip the
    // Authorization header on `/auth/refresh` itself. `/auth/refresh`
    // accepts the refresh token via body or `Authorization: Bearer
    // <refreshToken>` (back-end reads both in priority order at
    // auth.controller.ts:443). Auto-emitting
    // `Authorization: Bearer ${accessToken}` on a refresh request
    // would (a) confuse ops logs ("why is an accessToken being used
    // to refresh?"), (b) risk a 401 if the refresh endpoint ever
    // tightens its Authorization contract to a refresh-only token,
    // and (c) collide with the `refreshToken()` function below which
    // explicitly puts the refresh token in the body. The refresh
    // contract is body-first; the interceptor defers.
    const url = config.url || "";
    const isRefresh = url.includes("/auth/refresh");
    if (!isRefresh) {
      const { accessToken } = readPersistedTokens();
      if (accessToken) {
        config.headers = config.headers ?? {};
        config.headers["Authorization"] = `Bearer ${accessToken}`;
      }
    }
    config.headers = config.headers ?? {};
    config.headers["X-Device-Id"] = getDeviceId();
  } catch {
    // ignore — let the request proceed without auth headers
  }
  return config;
});

const refreshToken = async (): Promise<void> => {
  // v1.3.0 — send the refresh token in the BODY. The backend reads
  // `req.body.refreshToken` as a fallback when the cookie path was
  // blocked by Android WebView's third-party cookie policy. For
  // browser-side the cookie path still works (browser forwards
  // `refreshToken` cookie alongside the body), so backend-priority
  // cookie wins; the body fallback covers the broken-cookie case.
  const { refreshToken } = readPersistedTokens();
  await api.post("/auth/refresh", refreshToken ? { refreshToken } : {});
};

api.interceptors.response.use(
  (response) => {
    // Persist tokens from successful auth responses so the next
    // request's request-interceptor can pick them up. Fires on
    // /auth/{login,signup,firebase-login,refresh,set-cookies}
    // responses and any other endpoint that returns the token pair.
    const data = response.data as
      | { accessToken?: string; refreshToken?: string }
      | undefined;
    if (data?.accessToken && data?.refreshToken) {
      persistTokens(data.accessToken, data.refreshToken);
    }
    return response;
  },
  async (error: ApiError) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest.url?.includes("/auth/login")
    ) {
      return Promise.reject(error);
    }

    // Lógica para el resto de rutas protegidas
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await refreshToken();
        return api(originalRequest);
      } catch (refreshError) {
        requestQueue.process(refreshError);

        try {
          window.localStorage.removeItem(STORAGE_KEY_REFRESH);
          window.localStorage.removeItem(STORAGE_KEY_ACCESS);
        } catch {
          // ignore
        }

        // v1.3.0 (T3.3) — surface a toast and leave the redirect to
        // the next mount. Avoiding the immediate `window.location.href`
        // assignment prevents the "blanco con 429" symptom from the
        // user's trace (where the redirect races the toast duration
        // and ends up on an entirely blank page). The session-expired
        // UI now shows the toast and the next user-driven navigation
        // picks up the cleared auth state.
        toast.error("Tu sesión ha expirado por inactividad");

        // Don't hard-redirect; let React Router's redirect-on-render
        // pick up the cleared auth state via `useRestoreSession`'s
        // `setAuthReady` -> `ProtectedRoute` re-evaluation.
        return Promise.reject(refreshError);
      }
    }

    // Network error (ERR_NETWORK) OR proxy unavailable (502/503/504 via Vite) —
    // backend is unreachable or user is offline. Queue mutations for retry.
    const isNetworkError = !error.response;
    const isProxyError =
      error.response && PROXY_UNAVAILABLE_CODES.includes(error.response.status);

    if (isNetworkError || isProxyError) {
      const method = originalRequest.method?.toUpperCase() || "";
      const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

      if (isMutation) {
        // Strip the baseURL prefix so the URL is stored as a relative path.
        // When flushQueue replays through the same axios instance (which has baseURL),
        // it will correctly re-combine them without doubling.
        const baseURL = api.defaults.baseURL || "";
        let relativeUrl = originalRequest.url || "";
        if (baseURL && relativeUrl.startsWith(baseURL)) {
          relativeUrl = relativeUrl.slice(baseURL.length);
        }
        // Ensure it starts with /
        if (!relativeUrl.startsWith("/")) {
          relativeUrl = "/" + relativeUrl;
        }
        enqueueRequest(method, relativeUrl, originalRequest.data);
        // Return a resolved promise so the caller doesn't see an error and the
        // mutation's onSuccess fires, closing modals and providing feedback.
        return Promise.resolve({
          data: {
            _offline: true,
            _queued: true,
            message: "Saved offline — will sync when connection returns",
          },
        });
      }
    }

    return Promise.reject(error);
  },
);

// Re-export the storage key constants so callers (e.g. tests) can
// assert on them without re-declaring the magic strings.
export const ACCESS_TOKEN_STORAGE_KEY = STORAGE_KEY_ACCESS;
export const REFRESH_TOKEN_STORAGE_KEY = STORAGE_KEY_REFRESH;
export const X_DEVICE_ID_HEADER = "X-Device-Id";

export default api;
