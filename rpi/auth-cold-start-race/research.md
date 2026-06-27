# auth-cold-start-race Research

> Companion to `rpi/auth-cold-start-race/plan.md`. Companion artifact pair:
> `rpi/mobile-cookies-persistence/` (cookies v1.3.0) →
> `rpi/auth-cold-start-race/` (interceptor recursion v1.3.1 + cold-start preflight v1.3.2).

## Problem Context

After a successful `/auth/firebase-login` (which returns `{accessToken, refreshToken, user, message}` in the body), the Capacitor Android WebView falls into a cascade of `POST /api/auth/refresh {}` curls with **empty bodies**, until ThrottlerModule 429s the device-id bucket. The v1.3.1 hotfix (one-line `RETRY_GUARD = { _retry: true }` constant added to `apps/webClient/src/infrastructure/api.config.ts:103`) bounds each refresh attempt to **one** POST, so the recursion is closed at the interceptor level. BUT the v1.3.1 fix does not explain — and does not prevent — the up-stream condition: **why is `localStorage.refreshToken` empty at the moment the very first `refreshToken()` call fires?**

The answer is required for **three** classes of symptoms that the v1.3.1 fix does not address:

1. **Parallel-query cascade.** Multiple `useQuery` hooks mount without `_retry: true` (`apps/webClient/src/adapters/query/dashboard.tsx:8-13, 19-25, 35-43, 51-57`). Each fires on dashboard mount. If several 401 simultaneously, each independently calls `refreshToken()`. With v1.3.1, each fires one POST — not infinite — but the burst still produces N parallel POSTs to `/auth/refresh`. The first one to fail-clears-localStorage leaves the rest of the parallel batch posting `{}`.
2. **Returning-user stale tokens.** A user who logged in yesterday has a 7-day refreshToken in `localStorage`. Six hours later they relaunch. Tokens are still valid. But useRestoreSession's 5-min interval (`apps/webClient/src/adapters/hooks/useLoadUser.tsx:43`) fires `verifySession` against a backend whose `refreshToken:<userId>` Redis entry may have been evicted by a server-side restart or a manual remediation — the verify returns 401, the dashboard queries ALSO 401, and the cascade begins.
3. **Splash-then-dashboard double-verify.** `RootRoute` (`apps/webClient/src/presentation/pages/splash.tsx:194-203`) mounts `<SplashPage />` on first native boot, which calls `api.get("/auth/verify", { _retry: true })` AND `api.get("/user/profile", { _retry: true })`. Meanwhile `useRestoreSession` (`apps/webClient/src/adapters/hooks/useLoadUser.tsx:35-118`) is also running on root `App.tsx`. Two parallel verify calls against the same backend with the same X-Device-Id → `verifySession` THROTTLE_MS check at line 51 — the second call is suppressed for 30s. But the FIRST `verifySession` from the splash and the FIRST `verifySession` from useRestoreSession don't see each other in their throttles because each has its own `lastVerifyCallRef`. So **two** parallel `/auth/verify` calls go out. Both 401. Both blocked from triggering refresh. setAuthReady fires twice. React StrictMode fires each effect twice in dev — quadrupling the load.

### Current vs. desired behavior

| Path | Current (post-v1.3.1) | Desired (post-v1.3.2) |
|------|------------------------|------------------------|
| First 401 from non-`/auth/*` request is caught | refreshToken() fires once, with empty `{}` if localStorage was already empty | refreshToken() never fires if localStorage.refreshToken is null → return 401 cleanly → user re-logs in once, cascade is over |
| Multiple parallel queries fire on dashboard mount | Each posts `/auth/refresh` in parallel, producing N parallel curls | Either one refresh attempt orchestrates the others (`refreshPromise`), or all share a single in-flight refresh promise |
| Returning user reopens app after days | Cascade begins immediately on first 401; user gets bounced to login | Refresh attempt runs once, fails cleanly, user re-logs in once |
| Splash + useRestoreSession double-verify | Two parallel `/auth/verify` calls fire on cold start | One verify, the other defers or coalesces |

### Constraints

- v1.3.1's recursion break (`RETRY_GUARD`) is a hard requirement — Phase 1 of plan.md locks that in.
- Capacitor 7's `server.androidScheme: 'https'` makes cookies a third-party concept; the `Authorization: Bearer` header path is the already-shipped fallback (`apps/webClient/src/infrastructure/api.config.ts:148-160`).
- Backend's `auth.service.ts:328-329` (refreshToken) reads `refreshToken:<userId>` from Redis — when missing, throws 401. Any client whose body is empty POSTS to `refresh` will hit this path.
- The `useRestoreSession.verifySession` calls already use `{ _retry: true }` on `/auth/verify` and `/user/profile`, so the verify path is protected. The dashboard `useQuery` hooks are NOT.

### Why now (trigger)

The user on Capacitor Android APK reported two consecutive symptoms — first the v1.3.0 cookie-block cold restart logout (now mitigated by the body-token fallback), and now a fresh login that immediately cascades `POST /auth/refresh {}` curls. The v1.3.1 hotfix closes the recursion; this RPI investigates the upstream emptiness condition so the cascade doesn't enter at all.

## Affected Files

### Frontend — interceptor instrumentation

```
apps/webClient/src/infrastructure/api.config.ts:181-226                [EDIT: add a pre-flight check in the 401 handler — if localStorage.refreshToken is null, fail-fast with no POST]
apps/webClient/src/infrastructure/api.config.ts:155-176                [EDIT: refreshToken() — share a single in-flight promise across parallel calls (refresh-promise dedup)]
apps/webClient/src/infrastructure/device-id.ts                          [REVIEW: device-id is already there; no change]
```

### Frontend — query hook retrofit

```
apps/webClient/src/adapters/query/dashboard.tsx:8-65                   [EDIT: every useQuery hook accepts _retry:true via api config — moves the marker from per-call to default-on for dashboard fetches]
apps/webClient/src/adapters/query/dashboard.tsx:99-130                 [REVIEW: useFetchRecentSummary, useFetchBudgetCategories]
apps/webClient/src/adapters/query/reports/reportsQuery.tsx              [REVIEW: useOverview, useCategoryBreakdown, useWeeklyTrend — same retro if needed]
apps/webClient/src/adapters/query/userQuery.tsx                        [REVIEW: useGetSettings — same retro if needed]
```

### Frontend — diagnostic / log

```
apps/webClient/src/infrastructure/api.config.ts:170-180                [EDIT: keep the v1.3.1 console.warn that surfaces empty-body localStorage state, but enrich it with the call-site url + X-Device-Id + the exact age of the in-flight login attempt]
```

### Frontend — useRestoreSession + splash dedup

```
apps/webClient/src/adapters/hooks/useLoadUser.tsx:35-118               [EDIT: share a single verifySession promise between useRestoreSession and SplashPage so the two components don't fire two parallel /auth/verify calls on cold start]
apps/webClient/src/presentation/pages/splash.tsx:88-105                [EDIT: import useRestoreSession's verifySession (or its underlying api.get) into a shared module so SplashPage and useRestoreSession call one path]
```

### Backend — diagnostic

```
apps/api/src/adapters/auth/http/auth.controller.ts:438-462             [EDIT: in refreshToken, log when token was read from body-refreshToken but the cookie channel was empty (correlates the v1.3.1 fix's symptom to the body-input path)]
```

### Tests

```
apps/api/test/auth-cookie-bridge.spec.ts                                [EDIT: extend to cover the "refresh with empty body" sentinel — assert the diagnostic log line is emitted]
apps/webClient/tests/auth.spec.ts:108-end                               [EDIT: Add v1.3.2 regression tests for (a) parallel-query refresh dedup, (b) fail-fast-on-empty-localStorage, (c) splash+useRestoreSession verify dedup]
```

## Code Examples

### A. The symptom — refresh with empty body after fresh login

```
POST /api/auth/firebase-login  {idToken: "..."}                         ← 200 OK (body has tokens)
POST /api/auth/refresh        {}                                        ← 401 (no token)
POST /api/auth/refresh        {}                                        ← ... (loops, capped by throttle)
```

The body is empty. The interceptor at `apps/webClient/src/infrastructure/api.config.ts:170-180` reads `localStorage.refreshToken` synchronously — and gets null. Which means at this moment, either (a) the `/auth/firebase-login` response never persisted it (very rare, persistTokens has try/catch but never throws on Capacitor), or (b) something else cleared it.

### B. The current interceptor error handler — fails open on empty localStorage

```ts
// apps/webClient/src/infrastructure/api.config.ts:217-243 (post-v1.3.1)
async (error: ApiError) => {
  const originalRequest = error.config;

  if (
    error.response?.status === 401 &&
    (originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes("/auth/refresh"))
  ) {
    return Promise.reject(error);
  }

  if (error.response?.status === 401 && !originalRequest._retry) {
    originalRequest._retry = true;
    try {
      await refreshToken();              // ← no guardrail for empty localStorage
      return api(originalRequest);
    } catch (refreshError) {
      ...
      try {
        window.localStorage.removeItem(STORAGE_KEY_REFRESH);
        window.localStorage.removeItem(STORAGE_KEY_ACCESS);
      } catch {}
      toast.error("Tu sesión ha expirado por inactividad");
      return Promise.reject(refreshError);
    }
  }
  ...
```

The `refreshToken()` call has no preflight check. If `localStorage.refreshToken` is null, the call still fires — POST `/auth/refresh {}` — hits backend's "No refresh token provided" rejection — RETRY_GUARD-killer-kicks-in-rejects-with-no-recurse. With v1.3.1 the loop is gone. Without that preflight, the empty-body POST still happens on every 401 → irrecoverable empty localStorage forever until the user re-logs in. Phase 1 of plan.md adds the preflight.

### C. Parallel queries — each fires its own refresh attempt

```tsx
// apps/webClient/src/presentation/pages/dashboard/dashboardPage.tsx:25-31
const { data: overview, isLoading } = useFetchDashboard();
const { data: breackdown, isLoading: isloadingExpenseCat } =
  useFetchExpenseCategories();
```

```ts
// apps/webClient/src/adapters/query/dashboard.tsx:8-13
export const useFetchDashboard = () => {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: HttpDashboardRepository.getAll,
    retry: 3,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  });
};
```

If both 401 simultaneously, both independently hit the interceptor, both fire `refreshToken()`. Both fire `api.post("/auth/refresh", ...)` in parallel. With v1.3.1, each POST is a single shot — but the parallel burst produces N parallel POSTs. The first one to clear `localStorage` (via the catch block at lines 226-228) leaves subsequent parallel POSTs to send `{}` body.

Phase 2 of plan.md de-dupes parallel `refreshToken()` calls behind a single in-flight promise.

### D. Splash + useRestoreSession double-verify

```ts
// apps/webClient/src/presentation/pages/splash.tsx:88-99
(async () => {
  try {
    const response = await api.get("/auth/verify", { _retry: true });
    if (response.status === 200) {
      const userProfile = await api.get("/user/profile", {
        _retry: true,
      });
      ...
    }
  } catch (error) { ... }
  finally {
    dispatch(setAuthReady());
    go();
  }
})();
```

```ts
// apps/webClient/src/adapters/hooks/useLoadUser.tsx:67-95
const verifyPromise = api.get("/auth/verify", {
  _retry: true,
  timeout: VERIFY_TIMEOUT_MS,
});
...
if (response.status === 200) {
  const userProfile = await api.get("/user/profile", {
    _retry: true,
    timeout: VERIFY_TIMEOUT_MS,
  });
  ...
}
```

Two effects mount on cold start: `<App>` (mounted at root) AND `<SplashPage>` (mounted by `RootRoute` on first native boot, marked by `mobile.splash.shown` in sessionStorage). Both fire `/auth/verify` in parallel. With `retry: 3` configured at the useQuery level, dashboard queries WILL retry up to 3 times on failure — which compounds the parallel-batch problem when the first response is 401.

Phase 3 of plan.md dedups verify across these two callers.

### E. The throttle compounding

```ts
// apps/api/src/main.ts (approximate — full ThrottlerModule config in app.module.ts)
ThrottlerModule.forRoot({
  throttlers: [{ limit: 4, ttl: seconds(10) }],
  storage: new ThrottlerStorageRedisService({ host: process.env.REDIS_HOST || 'redis', ... }),
  getTracker: (req) => req.headers['x-device-id'] || req.socket.remoteAddress,
}),
```

When the burst exceeds 4 requests in 10s on the same X-Device-Id (per `device-id.ts`), the user hits 429. Mobile clients behind CGNAT share the IP fallback only if X-Device-Id is missing — `device-id.ts:10` ensures the header is always set, so the bucket isolation is correct. But the 4-rps budget means: **even after v1.3.1**, 4 parallel dashboard fetches × their retry: 3 retries = 12 POSTs in <10s on the same bucket — easily bursting.

## FAR Scale Output

| Dimension | Score | Justification |
|-----------|-------|---------------|
| **Factual** | 5 | Every cite is a file:line I read from the live repo in this conversation. The v1.3.1 fix's interception point is verified. The query hooks' lack of `_retry: true` is verified at `apps/webClient/src/adapters/query/dashboard.tsx:8-65`. The splash+useRestoreSession duplication is verified by direct file reads. |
| **Actionable** | 4 | All three phases ship as 1-3 file edits each with explicit line targets. One soft uncertainty: whether migrating the `_retry: true` from per-call to default-on for the dashboard `useQuery` hooks introduces a regression in a test scenario where the underlying endpoint really does need a 401 to trigger a 401-then-retry flow — Plan validates via the existing test suite. |
| **Relevant** | 5 | The user's bug trace (POST /auth/refresh {} after POST /auth/firebase-login) is exactly the symptom this research explains. The pre-flight + dedup fixes unblock the Android APK without regressing the web SPA. |
| **Mean** | **4.67** | **PASS** (≥ 4.00) |

```
F: 5  A: 4  R: 5  Mean: 4.67  --> PASS
```

## Testing Strategy

### Unit (mocked axios / useQuery)

Not feasible without adding vitest; deferred. Playwright covers the path that matters.

### Integration (Playwright)

- **`apps/webClient/tests/auth.spec.ts` — new test "parallel-query-refresh-dedup"**: Stubs axios via module mocking to ensure that when 3 dashboard fetches 401 simultaneously, only ONE `api.post("/auth/refresh", ...)` fires. The other 2 await the same in-flight promise.
- **`apps/webClient/tests/auth.spec.ts` — new test "fail-fast-on-empty-localStorage"**: Pre-populates localStorage with `accessToken` only (no `refreshToken`). Fires a 401. Asserts that NO `api.post("/auth/refresh", ...)` is fired — the interceptor fails fast and rejects. Pre-v1.3.2 it would have fired with `{}`.
- **`apps/webClient/tests/auth.spec.ts` — new test "splash-useRestoreSession-verify-dedup"**: Mounts `<App>` AND `<SplashPage>`. Stub API for `/auth/verify` with a delayed response. Assert only ONE axios call to `/auth/verify` was made within 1 second of mount.

### Backend (Jest)

- **`apps/api/test/auth-cookie-bridge.spec.ts` — extend**: Add a test that asserts the v1.3.1 diagnostic `🛡️ /auth/refresh received NO refresh token in any of the three source channels` log line IS emitted when all three channels are empty.

### Manual device smoke

- Build APK, install via `adb install-multi-package`.
- Cold-start app, observe behavior: no `/auth/refresh {}` curls should fire BEFORE login. They should NOT fire after login (because tokens were just persisted). They SHOULD fire at most ONCE if a stale-session scenario triggers a cascade.

## Potential Plan Pattern Recommendations

1. **Preflight-check + fail-fast.** Add a guard at the top of the response interceptor's 401 handler: if `localStorage.refreshToken` is null at the moment of the 401, fall through to `Promise.reject(error)` directly without firing `refreshToken()`. Cheap, surgical, and removes the empty-body POST entirely.
2. **In-flight refresh dedup.** Use a module-level `let inflightRefresh: Promise<void> | null = null;` and reuse it across parallel calls. Idiomatic for HTTP dehydration middleware.
3. **Verify-coalesce across mount points.** Move `verifySession`'s `/auth/verify` call into a shared `apps/webClient/src/infrastructure/verify-session.ts` module that exposes both `getVerifySession()` (used by `useRestoreSession` and `SplashPage`) and a `getUserProfile()` shared helper. Mounting both components then waits on the same promise. Cap parameter: missed initial verify triggers — already covered.
4. **Per-hook `_retry: true` retrofit.** Add `_retry: true` to every dashboard `useQuery` so individual endpoint failures don't trigger refresh. The session-refresh cascade becomes a single point — `useRestoreSession`. Coherent but invasive; lesser priority.

## Assumptions

1. ✅ Capacitor 7 + Android System WebView (Chrome ≥ 119) is the target. recent WebViews expose `crypto.randomUUID` so `device-id.ts:66-79` works without a polyfill.
2. ✅ The backend's `refreshToken` (`apps/api/src/application/auth/auth.service.ts:328-344`) treats `refreshToken === storedToken` strictly — any single-byte JWT mismatch causes 401. Defensive: a previously-issued refresh token whose Redis record is missing also 401s. Phase 1's preflight skips the POST entirely.
3. ⚠ The dedup approach uses a module-level `let inflightRefresh` variable. This is correct across React mount/unmount cycles because module-level state survives unmount. It does NOT survive a route reload — but route reload would mean a new module graph, which means the dedup is moot (the dedup is per-load).
4. ⚠ `apps/webClient/src/adapters/query/reports/reportsQuery.tsx` and `apps/webClient/src/adapters/query/userQuery.tsx` may have similar `useQuery` definitions without `_retry: true`. Plan covers the dashboard.tsx files first; a follow-up task upgrades the rest.
5. ✅ React 19 + StrictMode safely re-runs `useEffect` — the splash's parallel-mount interaction is bounded (Phase 3's verify coalesce addresses this).

## Out of Scope

- **Refresh-token rotation overhaul** — the body-token insertion does NOT change the underlying refresh token contract. A rotate-on-refresh RPI is its own ticket.
- **iOS-specific cookie handling** — `rpi/mobile-cookies-persistence/` covers Capacitor browser quirks; iOS WebView (WKHTTPCookieStorage) is not the Android case.
- **Diagnostic centralization (Sentry / Datadog)** — emitting a single `console.warn` is sufficient at the RPI scope; wiring observability is a follow-up.
- **`document.requestStorageAccess()` integration** — deferred entirely (see mobile-cookies-persistence §Out-of-scope).
- **Refresh-token theft detection** — out of scope; the existing per-IP throttle and Redis blacklist path are sufficient.

## Cross-Document Links

- `rpi/auth-cold-start-race/research.md` (this file) → `rpi/auth-cold-start-race/plan.md`
- `rpi/mobile-cookies-persistence/research.md` (v1.3.0 cookies fix, sibling RPI)
- `knowledge.md §16 Release Workflow` for the version-bump ritual that follows the Implement phase.
