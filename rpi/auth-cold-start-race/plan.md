# auth-cold-start-race Plan

> Companion to `rpi/auth-cold-start-race/research.md` (FAR Mean = 4.67, PASS).
> Goal: prevent the upstream condition (`localStorage.refreshToken` empty when a 401 fires) AND prevent parallel-query refresh-storms from reinflating the cascade, building on the v1.3.1 `RETRY_GUARD` that already caps the recursion.

## Implementation Overview

Three sequential phases, each ending at a quality gate. Phase 0 is the v1.3.1 fix that is **already shipped** in this session (verified at `apps/webClient/src/infrastructure/api.config.ts:103` and the regression test at `apps/webClient/tests/auth.spec.ts:108+`). Phase 1 (preflight fail-fast) and Phase 2 (in-flight dedup) close the cold-start race. Phase 3 (verify coalesce across splash + useRestoreSession) is a defense-in-depth polish.

1. **Phase 1 — Preflight fail-fast on empty localStorage.** Interceptor's 401 handler reads `localStorage.refreshToken` BEFORE calling `refreshToken()`. If null, log the v1.3.1 sentinel and `Promise.reject(error)` directly. No POST `/auth/refresh {}` ever fires.
2. **Phase 2 — Single in-flight refresh promise.** All 401 handlers dedup onto a module-level promise. N parallel queries → 1 refresh attempt, N concurrent awaits. Cheap and idiomatic.
3. **Phase 3 — Verify-coalesce across splash + useRestoreSession.** Move the `/auth/verify` + `/user/profile` calls into a shared `apps/webClient/src/infrastructure/verify-session.ts` module. SplashPage and useRestoreSession both `await getVerifySession()` instead of firing their own.

Building on v1.3.1's `RETRY_GUARD` (line 103), Phase 2's dedup, and Phase 1's preflight, the cascade is mathematically bounded: **at most one** POST to `/auth/refresh` regardless of how many parallel 401s fire, and **zero** POSTs if localStorage is empty.

Quality gates after each phase:
- `pnpm --filter frontend-web check-types`
- `pnpm --filter frontend-web lint`
- `pnpm --filter frontend-web test`

Final-gate adds:
- `pnpm --filter api lint`
- `pnpm --filter api test`
- `pnpm build`
- `pnpm --filter mobile sync` (regen Android manifest)

## Task Breakdown

### Phase 0 — v1.3.1 RETRY_GUARD shim (SHIPPED IN THIS SESSION)

> Goal: close the unbounded recursion with a one-line safe config.

- [x] **P0.1** `apps/webClient/src/infrastructure/api.config.ts:103` — introduce `RETRY_GUARD = { _retry: true } as AxiosRequestConfig & { _retry?: boolean }`.
- [x] **P0.2** `apps/webClient/src/infrastructure/api.config.ts:182` — pass `RETRY_GUARD` as the third arg to `api.post("/auth/refresh", ...)`.
- [x] **P0.3** `apps/webClient/src/infrastructure/api.config.ts:178-180` — add `console.warn('[v1.3.1] /auth/refresh POSTing with empty body — …')` when `localStorage.refreshToken` is null.
- [x] **P0.4** `apps/api/src/adapters/auth/http/auth.controller.ts:438-462` — log a diagnostic when token is missing from cookie+body+Authorization.
- [x] **P0.5** `apps/webClient/tests/auth.spec.ts:108+` — regression spec that caps `/auth/refresh` to ≤1 call when refresh itself 401s and clears localStorage.

### Phase 1 — Preflight fail-fast on empty localStorage

> Goal: never POST `/auth/refresh {}`. The empty body is now a sentinel, not a network call.

- [ ] **P1.1** `apps/webClient/src/infrastructure/api.config.ts:217-243` (`async (error: ApiError) => ...` body) — at the top of the 401 handler, immediately before `originalRequest._retry = true;`, add:
  ```ts
  if (error.response?.status === 401 && !originalRequest._retry) {
    const { refreshToken: storedRefresh } = readPersistedTokens();
    if (!storedRefresh) {
      console.warn(
        '[v1.3.2] /auth/refresh SKIPPED — localStorage.refreshToken is null at the 401-catch site. ' +
          'This is the v1.3.0 cascade precondition. Failing fast without POSTing.',
      );
      // Surface the Session Expired modal so the user has a clear recovery path.
      store.dispatch(logoutAction());
      toast.error("Tu sesión ha expirado por inactividad");
      return Promise.reject(error);
    }
    originalRequest._retry = true;
    try { await refreshToken(); ... }
  }
  ```
- [ ] **P1.2 [P]** `apps/webClient/tests/auth.spec.ts` — add a new test "v1.3.2 — preflight fail-fast on empty localStorage": pre-populates `localStorage.accessToken` only (no `refreshToken`), mocks `/api/dashboard/overview` to 401 and `/auth/refresh` count to 0, asserts the refresh count stayed at 0 and that `logoutAction` was dispatched.

### Phase 2 — In-flight refresh dedup

> Goal: N parallel 401s → 1 refresh POST, N concurrent awaits.

- [ ] **P2.1** `apps/webClient/src/infrastructure/api.config.ts:155-176` (the `refreshToken` function) — convert to:
  ```ts
  let inflightRefresh: Promise<void> | null = null;

  const refreshToken = async (): Promise<void> => {
    if (inflightRefresh) return inflightRefresh;
    inflightRefresh = (async () => {
      try {
        await performRefresh();  // existing body
      } finally {
        inflightRefresh = null;
      }
    })();
    return inflightRefresh;
  };
  ```
  Keep the existing `performRefresh` body intact — just wrap it.
- [ ] **P2.2 [P]** `apps/webClient/tests/auth.spec.ts` — add a test "v1.3.2 — parallel-query refresh dedup": pre-populates `localStorage`, mocks 3 different `useQuery` paths (e.g. `/api/dashboard`, `/api/expense-categories`, `/api/transactions`) to 401 simultaneously, asserts exactly ONE `api.post("/auth/refresh", ...)` fires within the test window, and the other two parallel awaits resolve to the same outcome (success or fail).

### Phase 3 — Verify-coalesce across splash + useRestoreSession

> Goal: ONE `/auth/verify` call on cold start, shared between SplashPage and useRestoreSession.

- [ ] **P3.1 [NEW]** Create `apps/webClient/src/infrastructure/verify-session.ts` — exports `getVerifySession(): Promise<VerifyResult>` that runs the existing verify + profile flow and is module-memoized so parallel mounts share the same promise.
- [ ] **P3.2** `apps/webClient/src/adapters/hooks/useLoadUser.tsx:67-95` — replace the inline `api.get("/auth/verify", ...)` + `api.get("/user/profile", ...)` with `await getVerifySession()`. The hook's `verifySession` becomes a thin wrapper.
- [ ] **P3.3** `apps/webClient/src/presentation/pages/splash.tsx:88-105` — same refactor: replace inline api.get calls with `await getVerifySession()`.
- [ ] **P3.4 [P]** `apps/webClient/tests/auth.spec.ts` — add a test "v1.3.2 — splash+useRestoreSession verify dedup": mounts both `<App>` and `<SplashPage>`, stubs `/auth/verify` with a 600ms delay, asserts exactly ONE axios call to `/auth/verify` within 1 second of mount and that `<App>` and `<SplashPage>` both reached the success branch.

### Phase 4 — Per-useQuery `_retry: true` retrofit (defense in depth, lower priority)

> Goal: dashboard fetches no longer trigger refresh on 401 at all. Refresh is the responsibility of `useRestoreSession`. Cuts the cascade entry-points from N to 1.

- [ ] **P4.1** `apps/webClient/src/adapters/query/dashboard.tsx:8-65` — every `useQuery` to add a wrapper that injects `_retry: true` config without changing `queryFn`. Implementation:
  ```ts
  export const useFetchDashboard = () => {
    return useQuery({
      queryKey: ["dashboard"],
      queryFn: () => HttpDashboardRepository.getAll().then(r => r),
      retry: 3,
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 5,
      // The api.config interceptor honours config._retry. Tap into
      // React Query's meta tag instead of queryFn to attach the flag.
      meta: { _retry: true },
    });
  };
  ```
  This requires a thin wrapper at `apps/webClient/src/infrastructure/api.config.ts` to read `meta._retry` and translate to axios `config._retry`. Alternative: a higher-order hook `useNoRetryQuery` that wraps `useQuery` and threads the flag.
- [ ] **P4.2 [P]** `apps/webClient/src/adapters/query/reports/reportsQuery.tsx` and `apps/webClient/src/adapters/query/userQuery.tsx` — same retrofit.
- [ ] **P4.3** `apps/webClient/tests/auth.spec.ts` — add a test "v1.3.2 — dashboard fetches don't trigger refresh": pre-populates localStorage, mocks `/api/dashboard/overview` to 401, asserts NO `/auth/refresh` call is made (the 401 falls through to the queryFn result).

### Phase 5 — Docs & release

> Goal: changelog entry and knowledge update.

- [ ] **P5.1** `docs/changelog.md:5` — prepend `[v1.3.2] — 2026-06-DD` with:
  - **Fixed** — Cold-start cascade of `POST /auth/refresh {}` curls on Capacitor Android APK.
  - **Added** — Preflight fail-fast on empty `localStorage.refreshToken`, in-flight refresh dedup, verify-coalesce across splash + useRestoreSession.
  - **Changed** — `apps/webClient/src/infrastructure/api.config.ts` wraps `refreshToken` in a single in-flight promise.
- [ ] **P5.2** `knowledge.md §13.3 Known Technical Debt` — append:
  - `Capacitor Android /auth/refresh cold-start race — see rpi/auth-cold-start-race/`

## Code References

### New files

```
apps/webClient/src/infrastructure/verify-session.ts        [NEW (P3.1)]
rpi/auth-cold-start-race/research.md                      [NEW (this session, before P3.1)]
rpi/auth-cold-start-race/plan.md                          [NEW (this session, before P3.1)]
```

### Files to edit

```
apps/webClient/src/infrastructure/api.config.ts:217-243   [P1.1 preflight fail-fast]
apps/webClient/src/infrastructure/api.config.ts:155-176   [P2.1 in-flight dedup]
apps/webClient/src/adapters/hooks/useLoadUser.tsx:67-95   [P3.2 use shared verify-session]
apps/webClient/src/presentation/pages/splash.tsx:88-105   [P3.3 use shared verify-session]
apps/webClient/src/adapters/query/dashboard.tsx:8-65      [P4.1 per-hook _retry:true]
apps/webClient/src/adapters/query/reports/reportsQuery.tsx [P4.2 retrofit]
apps/webClient/src/adapters/query/userQuery.tsx           [P4.2 retrofit]
apps/webClient/tests/auth.spec.ts                         [P1.2 / P2.2 / P3.4 / P4.3 tests]
apps/api/test/auth-cookie-bridge.spec.ts                  [Backend test] — covered by P0.5 (already shipped)
docs/changelog.md                                         [P5.1 v1.3.2 entry]
knowledge.md §13.3                                        [P5.2 known-debt entry]
```

## Testing Plan

| Layer | Approach |
|-------|----------|
| Unit (Backend Jest) | `apps/api/test/auth-cookie-bridge.spec.ts` — verify the diagnostic log line is emitted when the body is empty. This was added in v1.3.1 (Phase 0, already shipped). |
| E2E (Playwright) | `apps/webClient/tests/auth.spec.ts` — 4 new spec cases (P1.2, P2.2, P3.4, P4.3) with mocked routes. Verify the cascade is bounded as designed. |
| Manual device smoke | Build APK, install via `adb install-multi-package`, exercise: (a) cold start → no `/auth/refresh {}` curls; (b) log in → token persists → no cascading; (c) background-and-resurrect after 1 hour → cascade fires ONE POST, gracefully degrades to login. |
| Lint/build gates | After every phase: `pnpm --filter frontend-web check-types && pnpm --filter frontend-web lint && pnpm --filter frontend-web test`. Final gate adds `pnpm --filter api lint && pnpm --filter api test && pnpm build`. |
| Cleanup invariant | After every phase: `rg 'RETRY_GUARD|_retry: true' apps/webClient/src --type ts --type tsx` shows the new fleet is consistent — no orphan `api.post("/auth/refresh", ...)` calls. |
| Regression coverage | Existing `home.spec.ts`, `auth.spec.ts`, `i18n.spec.ts`, `currency-conversion.spec.ts`, `offline-queue.spec.ts`, `transaction-form.spec.ts`, `income-merger.spec.ts`, `api.config.ts:148-160` (the v1.3.0 body-token path) all continue to pass. |

## FACTS Scale Output

| Dimension | Score | Justification |
|-----------|-------|---------------|
| **Feasibility (F)** | 5 | All tasks use existing patterns: prefail-fast matches the existing `if (!token)` pattern in `auth.controller.ts:447`; in-flight dedup is a 5-line well-known middleware pattern; verify-coalesce is a `let inflightVerify = null;` module memoization, matches `ensureSocialLoginInitialized` at `apps/webClient/src/adapters/auth/native-google-login.strategy.ts:55-79`. No third-party service adds, no native code changes. |
| **Atomicity (A)** | 5 | Each task is single-file or single-line. Largest is P3.1 (NEW ~30 LOC) and P5.1 (changelog entry). No task spans > 2 files. |
| **Clarity (C)** | 4 | Paths and line ranges are precise. One small uncertainty: the per-hook `_retry:true` retrofit (P4.1) requires a translation layer between React Query's `meta` and axios's `config._retry` — implementer decides between `queryFn` wrapper vs `meta`-read interceptor addition. Adjust by `rg` at execute-time. |
| **Testability (T)** | 5 | Specs P1.2 / P2.2 / P3.4 / P4.3 cover the path. The empty-body preflight is reproducible without device. Device smoke in P5 catches any WebView-vs-Chromium divergence. |
| **Size (S)** | 5 | Phases balanced: P0=5, P1=2, P2=2, P3=4, P4=3, P5=2. No task > 30 LOC. |
| **Mean** | **4.80** | **PASS** (≥ 3.00) |

```
F: 5  A: 5  C: 4  T: 5  S: 5  Mean: 4.80  --> PASS
```

## Dependencies & Sequencing

```
Phase 0 (SHIPPED) — Phase 1 gate —► Phase 2 gate —► Phase 3 gate —► Phase 4 gate —► Phase 5 gate (release)
  │                                   │                  │                  │              │
  │                                   │                  │                  │              │
RETRY_GUARD one-line fix.      Preflight fail-fast.  In-flight dedup.  Verify coalesce. Per-hook _retry: Docs + release.
Closes recursion.              Closes empty-body.  Collapses burst.   Removes double-  true retrofit.
                                                  verify at cold     Closes last
                                                  start.             entry.
```

Critical-path constraints:
- Phase 1 must land BEFORE Phase 4 lands — the preflight is the surgical fix and the per-hook-retrofit is the polish.
- Phase 2 must land AFTER Phase 0 already deployed (Phase 2 relies on v1.3.1's recursion cap; otherwise it would still loop on a /auth/refresh 401).
- Phase 5's device smoke in CI — Capacitor + Gradle is not in the hosted sandbox per `docs/changelog.md` v1.2.0 quality-gates note ("🟡 Native `./gradlew assembleRelease` not executed in this sandboxed environment — run locally + on CI to confirm gradle resolves…"). P5 device smoke is operator-deliverable.

Parallel-execution opportunities (within a phase):
- P1.1 / P1.2 — same file, sequential.
- P3.2 / P3.3 — different files, parallel.
- P4.1 / P4.2 / P4.3 — different files, parallel.

External dependencies: **none**. No webhook, payment, third-party service. Backend-only, frontend-only.

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Phase 1 fail-fast hides a legitimate scenario where `localStorage.refreshToken` was never populated because of a streaming/chunked POST response | Low | User cannot recover from auth failure they should recover from | Console.warn is loud enough to surface in dev; `logoutAction` + toast gives the user a clear path; the catch block at api.config.ts line 226-228 still fires. |
| Phase 2 dedup never resolves (e.g. refresh hangs) and blocks all subsequent /auth/refresh calls forever | Low | Recovery becomes impossible until page reload | The `try { ... } finally { inflightRefresh = null; }` (P2.1) ensures the lock is always released, both on success and failure. Even an axios hang will eventually timeout and the catch clears `inflightRefresh`. |
| Phase 3 verify-coalesce breaks the splash's `useEffect`-cleanup pattern because the shared promise can't be cancelled | Medium | Splash's `cancelled` flag stops mattering; the shared verify completes whether or not Splash unmounts | Mounting the verify once means the result flows to all consumers through a single resolve. The original `cancelled` flag was a workaround for double-mounts; in v1.3.2 the second mount awaits the same promise, no need to cancel. |
| Phase 4 retrofit regresses an existing test that intentionally expected a dashboard 401 to trigger refresh | Low | Test suite fails on rollout | Existing test inventory (`transaction-form.spec.ts`, `currency-conversion.spec.ts`, `income-merger.spec.ts`) all mock `/api/dashboard` to 200 so 401 is never the path. Phase 4's new spec P4.3 owns the 401 path. |
| React Query `meta` flag isn't forwarded to axios config without a wrapper | Medium | P4.1 implementation needs a non-trivial shim | Either thread `meta._retry` into a custom hook, OR wrap `queryFn` to attach `_retry:true` to a marker field that the api.config.ts interceptor reads. Two correct paths documented; implementer picks. |

## Rollback Strategy

| Phase | Rollback Procedure |
|-------|--------------------|
| **Phase 1** | `git revert <phase-1-commit>`. The preflight check is two added lines. No state change. **Zero DB-impacting rollback.** |
| **Phase 2** | `git revert <phase-2-commit>`. The dedup wrapper is replaced; falls back to per-call refresh. Still bounded by v1.3.1 Phase 0. **No data loss.** |
| **Phase 3** | `git revert <phase-3-commit>`. Removes the shared `verify-session.ts`. Both `useRestoreSession` and `SplashPage` revert to their inline `api.get("/auth/verify", ...)` paths. Useful to defer if the cleanup invariant finds the splash's `useEffect` cancellation pattern is more fragile than expected. |
| **Phase 4** | `git revert <phase-4-commit>`. The retrofit is a hook change; falls back to without-`_retry:true` semantics for dashboard endpoints. The cache `/auth/refresh` behaviour is unchanged because the existing interceptor and v1.3.1 cap still apply. |
| **Phase 5** | N/A — docs only. |

### Postmortem trigger conditions

A `plan-postmortem.md` is generated at `rpi/auth-cold-start-race/plan-postmortem.md` if:
- Phase 1 lands but a regression in a cookie-capable web SPA appears (the preflight should not fire on the web SPA — the SPA's cookie path always populates `localStorage` after login).
- Phase 2's in-flight promise somehow holds a Zalgo ref (fails open or fails closed incorrectly between renders).
- Phase 3's verify-coalesce breaks the splash-vs-useRestoreSession ordering: if the user clicks "Sign in" on splash before `getVerifySession` resolves, the splash fires `/auth/verify` AND the login fires `/auth/login` — they don't share a promise; that's fine, but verify NEXT might still return 401 + retry. Audit log: confirm only ONE verify call per mount cycle.
- Phase 4's per-hook retrofit regresses ANY existing Playwright spec.

## Reference

- Research artifact: `rpi/auth-cold-start-race/research.md` (FAR Mean = 4.67, PASS)
- Framework: `docs/rpi/Research.md`, `docs/rpi/Plan.md`, `docs/rpi/Implement.md`
- Project conventions: `@capgo/capacitor-social-login` install pattern, in-flight-promise dedup pattern (mirrors `apps/webClient/src/adapters/auth/native-google-login.strategy.ts:55-79`)
- Sibling RPI: `rpi/mobile-cookies-persistence/` — the upstream Set-Cookie / body-token pipeline that made v1.3.1 necessary.
- Quality gates: `pnpm --filter api lint && pnpm --filter api test && pnpm --filter frontend-web lint && pnpm --filter frontend-web test && pnpm build`.
