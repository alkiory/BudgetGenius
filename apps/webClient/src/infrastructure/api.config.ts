import { logoutAction } from "@adapters/slices/auth/authSlice";
import { store } from "@adapters/store/rootStore";
import axios from "axios";
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import toast from "react-hot-toast";
// Internal imports grouped in alphabetical order per the
// project's `import/order` eslint rule.
import { getDeviceId } from "./device-id";
import { isNativePlatform } from "./native";
import {
  carriesCredentials,
  clearQueue,
  enqueueRequest,
  registerOnlineListener,
  resumeQueue,
} from "./offline-queue";
import { queryClient } from "./queryClient";
import { requestQueue } from "./request-queue";

interface ApiError {
  config: AxiosRequestConfig & {
    /** Caller opt-out: never attempt a token refresh for this request. */
    _retry?: boolean;
    /** Set by this interceptor once the request has consumed a refresh. */
    _sessionRetry?: boolean;
    _retryCount?: number;
    /** Caller opt-out: never queue this mutation for offline replay. */
    skipOfflineQueue?: boolean;
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

/**
 * Auth responses that open (or restore) a session, so the offline queue may
 * accept work again. `/auth/logout` is deliberately absent: it ends the
 * session, and resuming there would undo the purge.
 */
const SESSION_STARTING_URL =
  /\/auth\/(login|signup|firebase-login|refresh|verify)\b/;

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
//      keep `data.accessToken` + `data.refreshToken` in module memory
//      for the rest of the page's lifetime. QA-0.5: they are NO LONGER
//      written to `localStorage` on the web — see `saveTokens`.
//   2. **Request interceptor** — attach `Authorization: Bearer
//      <in-memory token>` so the backend's auth pipeline works even if
//      cookies were dropped. Backend already allowlists
//      `Authorization` in CORS (`apps/api/src/cors.ts`).
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
 * Marker config that tells the response interceptor's 401 handler
 * "this request has already been processed by the refresh-once path
 * — do NOT recurse into another refresh-token attempt".
 *
 * v1.3.1 hotfix: previously the `refreshToken()` helper did
 * `await api.post("/auth/refresh", refreshToken ? { refreshToken } : {})`
 * with NO `_retry` flag. When /auth/refresh itself 401s (e.g. session
 * revoked, empty body, token rejected), the interceptor's error
 * handler saw the 401 without `_retry` and called `refreshToken()`
 * AGAIN, which produced ANOTHER `api.post("/auth/refresh", ...)`
 * with NO `_retry` flag — and that one's 401 spawned yet another,
 * ad infinitum. This constant is the loophole the user saw in
 * production: an unbounded cascade of `POST /api/auth/refresh {}`
 * curls hitting the backend, capped only by ThrottlerModule hitting
 * 429 on the device-id bucket.
 *
 * Now the nested refresh POST carries `_retry: true`, so the
 * interceptor's 401 handler declines to recurse (it falls into
 * `Promise.reject(error)`), the outer `await refreshToken()` rejects,
 * and the parent request's `catch (refreshError)` block runs as
 * designed: clears the token copies, fires the "sesión expirada" toast.
 */
const RETRY_GUARD = { _retry: true } as AxiosRequestConfig & {
  _retry?: boolean;
};

/**
 * Token storage.
 *
 * QA-0.5 — a browser no longer persists JWTs to `localStorage`: Web
 * Storage is readable by any script on the origin, so one XSS (or one
 * compromised dependency) walks away with a 7-day refresh token. The web
 * SPA authenticates through the server's `HttpOnly; Secure;
 * SameSite=None` cookies; the copy below just lets the same tab send
 * `Authorization: Bearer` and replay the refresh token in the
 * `/auth/refresh` body until the next reload.
 *
 * The Capacitor WebView is the one runtime that needs a durable copy:
 * Android System WebView drops cross-origin `Set-Cookie`, so the APK has
 * no cookie channel and would lose the session on every cold start.
 *
 * Why no JS-side `document.cookie` write: the server sets the cookie via
 * `Set-Cookie`; a JS-side `SameSite=Lax` cookie for the same name would
 * desync it (the browser keeps one and ignores the other).
 */
const persistsTokens = isNativePlatform();

let tokens: {
  accessToken: string | null;
  refreshToken: string | null;
} = { accessToken: null, refreshToken: null };

// Leftovers from builds that stored the pair here. Dropped once at boot;
// nothing below reads them on the web any more.
if (!persistsTokens) {
  try {
    window.localStorage.removeItem(STORAGE_KEY_ACCESS);
    window.localStorage.removeItem(STORAGE_KEY_REFRESH);
  } catch {
    // localStorage may throw in incognito / sandboxed contexts.
  }
}

function saveTokens(accessToken: string, refreshToken: string): void {
  tokens = { accessToken, refreshToken };

  if (!persistsTokens) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY_ACCESS, accessToken);
    window.localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
  } catch {
    // WebView storage unavailable — the in-memory copy still works.
  }
}

function loadTokens(): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  // Cold start on native: the in-memory pair is empty, the cookie channel
  // is broken, so the persisted copy is the only session left.
  if (persistsTokens && !tokens.accessToken && !tokens.refreshToken) {
    try {
      tokens = {
        accessToken: window.localStorage.getItem(STORAGE_KEY_ACCESS),
        refreshToken: window.localStorage.getItem(STORAGE_KEY_REFRESH),
      };
    } catch {
      // ignore — stay on the empty in-memory pair
    }
  }

  return tokens;
}

/** Clears both channels: logout, delete-account, unrecoverable refresh. */
export function clearPersistedTokens(): void {
  tokens = { accessToken: null, refreshToken: null };

  try {
    window.localStorage.removeItem(STORAGE_KEY_ACCESS);
    window.localStorage.removeItem(STORAGE_KEY_REFRESH);
  } catch {
    // incognito / sandboxed contexts
  }
}

/**
 * Route prefix of the authenticated area. The session-expired toast is
 * only meaningful there — public pages must stay silent.
 */
const APP_ROUTE_PREFIX = "/app";

/**
 * Set while the local session is known to be dead, so the parallel 401s
 * of one lost session run the cleanup exactly once and never start
 * another refresh. Reset by any successful `/auth/*` round-trip.
 */
let sessionExpired = false;

/**
 * Ends the local session after a 401 that refreshing cannot recover.
 *
 * Before this, the handler only cleared the in-memory tokens and showed
 * a toast: `authSlice` kept the user marked as authenticated, so
 * `<AuthGuard>` never redirected, the dashboard stayed mounted, and its
 * `useQuery({ retry: 3 })` hooks kept hitting the dead session. Every
 * failed request (and every retry) fired its own toast — hence the
 * endless stack of "Tu sesión ha expirado por inactividad", which also
 * kept appearing after the user had navigated to the public landing.
 *
 * Now the first unrecoverable 401:
 *   1. clears the token copies,
 *   2. clears the React Query cache (cancels the retry loops that
 *      produced the toast storm),
 *   3. dispatches `logoutAction`, which makes `<AuthGuard>` navigate any
 *      `/app/*` route to `/auth/login` on the same render,
 *   4. shows one toast, only on the authenticated area and always under
 *      the same toast id so it can never stack.
 */
function endSession(): void {
  if (sessionExpired) {
    return;
  }
  sessionExpired = true;

  clearPersistedTokens();
  // Expiry is a session end too: the next person at this browser profile must
  // not find the previous account's queued amounts and descriptions.
  clearQueue();
  queryClient.clear();
  store.dispatch(logoutAction());

  if (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith(APP_ROUTE_PREFIX)
  ) {
    toast.error("Tu sesión ha expirado por inactividad", {
      id: "session-expired",
    });
  }
}

// ── Request interceptor: attach Authorization + X-Device-Id ────────
//
// Registered BEFORE the response interceptor so every outbound
// request picks up the headers. Headers are computed fresh per request,
// so a retry never re-emits a token that was cleared in the meantime.
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
    config.headers = config.headers ?? {};

    if (!config.url?.includes("/auth/refresh")) {
      const { accessToken } = loadTokens();
      if (accessToken) {
        config.headers["Authorization"] = `Bearer ${accessToken}`;
      }
    }

    config.headers["X-Device-Id"] = getDeviceId();
  } catch {
    // ignore — let the request proceed without auth headers
  }
  return config;
});

/**
 * Actual refresh round-trip. Kept separate from the dedupe wrapper so
 * the single-flight promise below stays trivial.
 */
const performRefresh = async (): Promise<void> => {
  // A browser authenticates with the HttpOnly refreshToken cookie, so an
  // empty body is the normal case there. Native sends the token in the
  // body because Android's WebView dropped that cookie.
  const { refreshToken: stored } = loadTokens();

  await api.post(
    "/auth/refresh",
    stored ? { refreshToken: stored } : {},
    // v1.3.1 — see RETRY_GUARD docblock above.
    RETRY_GUARD,
  );
};

let inflightRefresh: Promise<void> | null = null;

/**
 * Single-flight refresh.
 *
 * A page can mount several protected queries at once (dashboard +
 * budgets + recent summary + settings). When the session dies they all
 * 401 in the same tick; previously each one POSTed `/auth/refresh`, so
 * the server saw a burst and the UI got one failure per query. Sharing
 * the in-flight promise collapses that burst into exactly one refresh
 * attempt, and every caller observes the same outcome.
 */
const refreshToken = (): Promise<void> => {
  if (inflightRefresh) {
    return inflightRefresh;
  }

  inflightRefresh = performRefresh().finally(() => {
    inflightRefresh = null;
  });

  return inflightRefresh;
};

api.interceptors.response.use(
  (response) => {
    // Persist tokens from successful auth responses so the next
    // request's request-interceptor can pick them up. Fires on
    // /auth/{login,signup,firebase-login,refresh}
    // responses and any other endpoint that returns the token pair.
    const data = response.data as
      | { accessToken?: string; refreshToken?: string }
      | undefined;
    if (data?.accessToken && data?.refreshToken) {
      saveTokens(data.accessToken, data.refreshToken);
    }

    // Any successful auth round-trip (login, refresh, verify) means the
    // local session is alive again: allow the next unrecoverable 401 to
    // notify the user. Without this reset, a re-login after an expiry
    // would leave the handler thinking the session had already ended.
    const url = response.config.url ?? "";
    if (url.includes("/auth/")) {
      sessionExpired = false;
    }
    // Only the endpoints that OPEN a session unseal the queue. `/auth/logout`
    // also matches the prefix, and resuming there would undo the purge.
    if (SESSION_STARTING_URL.test(url)) {
      resumeQueue();
    }

    return response;
  },
  async (error: ApiError) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest.url ?? "";

    if (error.response?.status === 401) {
      // Auth endpoints answer for themselves: a failed login, refresh or
      // logout must reach its caller unchanged, never through a refresh.
      if (requestUrl.includes("/auth/")) {
        return Promise.reject(error);
      }

      // The session was already ended by another request: reject without
      // refreshing again (and without another toast).
      if (sessionExpired) {
        return Promise.reject(error);
      }

      // Callers such as `useRestoreSession` mark `_retry` to opt out of
      // the refresh path — their 401 means "no session yet", not
      // "session expired", and must stay silent.
      if (originalRequest._retry) {
        return Promise.reject(error);
      }

      // Already refreshed once and still 401: the session is unusable,
      // so do not start a second refresh — end it now.
      if (originalRequest._sessionRetry) {
        endSession();
        return Promise.reject(error);
      }

      originalRequest._sessionRetry = true;
      try {
        await refreshToken();
        return api(originalRequest);
      } catch (refreshError) {
        requestQueue.process(refreshError);
        endSession();
        return Promise.reject(refreshError);
      }
    }

    // Network error (ERR_NETWORK) OR proxy unavailable (502/503/504 via Vite) —
    // backend is unreachable or user is offline. Queue mutations for retry.
    // A structured `{ code }` body means the backend answered on purpose
    // (e.g. Finny's 503 setup state), so it must reach the caller instead of
    // being mistaken for the dev proxy being down.
    const isNetworkError = !error.response;
    const isAppError =
      typeof (error.response?.data as { code?: unknown } | undefined)?.code ===
      "string";
    const isProxyError =
      !isAppError &&
      error.response &&
      PROXY_UNAVAILABLE_CODES.includes(error.response.status);

    if (isNetworkError || isProxyError) {
      const method = originalRequest.method?.toUpperCase() || "";
      const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

      // Credentials never reach storage: a queued password change would sit
      // in `localStorage` in plaintext and, worse, report success to a form
      // whose value was never applied. Those requests fail loudly instead.
      const queueable =
        isMutation &&
        !originalRequest.skipOfflineQueue &&
        !carriesCredentials(originalRequest.data);

      if (queueable) {
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

export const X_DEVICE_ID_HEADER = "X-Device-Id";

export default api;
