# mobile-cookies-persistence Plan

> Companion to `rpi/mobile-cookies-persistence/research.md` (FAR Mean = 4.67 PASS).
> Goal: ship a fix that resolves the Capacitor Android WebView third-party cookie blocking so that every APK user keeps a session past the first access-token expiry, **without** regressing the web SPA logged-in experience. Five phases, sequential, each ending at a compile+test boundary.

## Implementation Overview

Three coordinated changes — one server, one frontend, one native config — close the bug from both directions (defense-in-depth):

1. **Backend surfaces `accessToken` + `refreshToken` in response bodies** — the existing controller routes already return `{user, message}` (and `/auth/signup` already returns tokens in body); the asymmetric ones (`/auth/firebase-login`, `/auth/login`, `/auth/refresh`) are corrected. Cookies continue to be set for the same-site browser path.
2. **`@capacitor-community/cookies` enters `apps/mobile`** — installs a native `CookieManager` rewrite path so cookies set via the Capacitor plugin *do* round-trip through the WebView's subsequent requests. Driven from a thin JS shim in `apps/webClient/src/infrastructure/capacitor-cookies.ts` (so the web SPA stays a no-op shim path).
3. **Frontend `api.config.ts` interceptor writes tokens to BOTH localStorage AND the cookies-shim on every successful auth response**, attaches `Authorization: Bearer` (or relies on persisted cookie) on every subsequent request, and emits `X-Device-Id` so the global ThrottlerModule has a stable per-install identity.
4. **`@SkipThrottle()` on `/auth/refresh`** — refresh is on a known cadence; the global 4-rps throttle currently bursts-blocking legitimate mobile refreshes (CGNAT aggravates this).

Architectural decisions all locked from Research:

- ✅ Tokens-in-body + Set-Cookie both: the controller emits both; the client prefers whichever path is healthy.
- ✅ Cookies plugin Native store, NOT WebView JS store — that is the entire reason this fix works.
- ✅ Authorization: Bearer header is the **fallback** (covers the case where the Capacitor cookies-plugin write somehow fails on a niche device/Chrome build).
- ✅ SkipThrottle on `/auth/refresh` — refresh is never user-spammed; the 4-rps limit was a web-SPA-tuned heuristic that bites mobile.
- ℹ️ The chosen Capacitor cookies plugin version is `@capacitor-community/cookies` at the major that has Capacitor 7 peer-dep — Installation step **T2.1** will pin a specific version and `pnpm install` will validate.

Quality gates after **every** task: `pnpm --filter api lint && pnpm --filter api test && pnpm --filter frontend-web lint && pnpm --filter frontend-web test`. Final-gate adds `pnpm build` and `pnpm --filter mobile sync` (regen Android manifest).

## Task Breakdown

### Phase 1 — Surface tokens in response bodies (backend)

> Goal: the controller response payload is rich enough for the WebView to persist tokens client-side WITHOUT needing the cookie path to survive. Backward compatible — `user` and `message` keys are preserved.

- [ ] **T1.1** Edit `apps/api/src/adapters/auth/http/auth.controller.ts:178-189` (`firebaseLogin`). Extend return shape to include `accessToken` and `refreshToken` alongside `user` and `message`. Keep `setCookie` calls unchanged (browser path).
- [ ] **T1.2** Edit `apps/api/src/adapters/auth/http/auth.controller.ts:243-258` (`signup`). Verify that helper already returns `{accessToken, refreshToken, user, isNewUser, message}` at lines ~263–270 — just bump Swagger docstring example to make the new fields visible in the schema block. (Likely a no-op edit; verify and lock with a one-line docstring bump for docs parity.)
- [ ] **T1.3** Edit `apps/api/src/adapters/auth/http/auth.controller.ts:297-301` (`login`). Extend return shape to include tokens. The `result` from `authService.login()` already exposes `accessToken`, `refreshToken`, `user` — just destructure them all.
- [ ] **T1.4** Edit `apps/api/src/adapters/auth/http/auth.controller.ts:436-465` (`refreshToken`). Extend return shape to include the **new** accessToken (already-on-hand as `newAccessToken`). Refresh-token itself is the same one the user posted, so do NOT re-emit it (avoids accidental truly-stale double-store). Body shape: `{ success: true, accessToken: newAccessToken, user: { id: userId } }`.
- [ ] **T1.5** Edit `apps/api/src/app.module.ts:161-170` (`cookieOptions`). Bump default `maxAge` from 15 minutes to **30 minutes** for production. (Refresh cadence ≈ 1 per access-token lifetime — keeps burst within 2-rps once access-token expires, easily under the 4-rps throttle now that the `SkipThrottle` exists on `/auth/refresh`). Add inline comment citing `rpi/mobile-cookies-persistence/research.md`.
- [ ] **T1.6** Edit `apps/api/test/auth-service.spec.ts` — extend each existing assertion (login/signup/firebase-login/refresh tests) with `expect(...).toHaveProperty('accessToken')` and `expect(...).toHaveProperty('refreshToken')` for the three auth flows that should emit them. The refresh test asserts response has a new `accessToken` ≠ the prior one (verifies the rotation).
- [ ] **T1.7 [P]** Add `apps/api/test/auth-cookie-bridge.spec.ts` (test name `[P]` — parallelizable). Spec verifies the controller emits BOTH a Set-Cookie header **and** a body token for `/auth/firebase-login`, `/auth/login`. Uses supertest against the configured `INestApplication` (full AppModule) — settle on the same pattern used by `apps/api/test/auth-throttle.e2e-spec.ts` (ThrottlerModule override there is a useful template).
- [ ] **Phase 1 gate** — `pnpm --filter api lint && pnpm --filter api test`. Backend ready to deliver tokens in body. Frontend untouched yet.

### Phase 2 — Install the Capacitor cookies plugin

> Goal: the Capacitor app has a working native CookieManager write/read path. Web SPA path is unaffected (plugin is dynamically imported, falls back to `localStorage` adapter when no native runtime).

- [ ] **T2.1** Edit `apps/mobile/package.json:11` — append `@capacitor-community/cookies: ^6.0.0` (or whichever resolution `pnpm install` accepts against the existing `@capacitor/core@^7.6.7` peer). Use `pnpm add` rather than hand-edit (the team's codified convention per `knowledge.md §8 Package Management`).
- [ ] **T2.2** Verify `pnpm-lock.yaml` resolves cleanly. If the peer-dep matrix rejects a `^6` against Capacitor 7, fall back to `^7.0.0` only after confirming the latest major's compatibility with the installed `@capacitor/core@^7.6.7`.
- [ ] **T2.3 [P]** Edit `apps/mobile/capacitor.config.ts` — add a `plugins.Cookies: {}` block so on `npx cap sync` the plugin's auto-registration is wired. (Empty config is fine; the plugin's defaults are correct.)
- [ ] **T2.4 [P]** Run `pnpm --filter mobile sync`. Verify `apps/mobile/android/app/src/main/assets/capacitor.plugins.json` now contains `@capacitor-community/cookies`.
- [ ] **T2.5** Verify `apps/mobile/android/app/src/main/java/com/budgetgenius/mobile/MainActivity.java` did not need editing — Capacitor 7 auto-imports plugin classes; cookies is JS-only with native-bridge dispatch.
- [ ] **T2.6** Add `apps/webClient/src/infrastructure/capacitor-cookies.ts` [NEW]. Exports `Cookies` object: `get(url)`, `set(key, value, url, expires?)`, `clearAll(url)`. Implemented as:
  - On native runtime (`Capacitor.isNativePlatform() === true`): wraps `CapacitorCookies.{getCookies, setCookie, clearCookies}`. Plugin is dynamically imported (mirrors the SocialLogin import pattern in `apps/webClient/src/adapters/auth/native-google-login.strategy.ts:65-95`) so web builds don't try to resolve the plugin.
  - On web runtime: redirects to `localStorage` with a key prefix `bg-cookie:` to indicate the bridge purpose.
- [ ] **T2.7 [P]** Edit `apps/webClient/src/main.tsx` — call `Cookies.init?.()` once at app startup (resolves to a no-op on web; awaits the dynamic import + sets a memoized initialization promise on native). Mirror the `ensureSocialLoginInitialized` pattern in `apps/webClient/src/adapters/auth/native-google-login.strategy.ts:50-78`.
- [ ] **Phase 2 gate** — `pnpm --filter mobile sync && pnpm --filter frontend-web build && pnpm --filter frontend-web lint`. Capacitor cookies plugin is wired; web path is unchanged.

### Phase 3 — Frontend interceptor with `Authorization` fallback + localStorage write

> Goal: every successful auth response persists tokens client-side; every subsequent request carries the auth credential by the most-reliable channel available; cookie-channel failures degrade gracefully.

- [ ] **T3.1 [P]** Edit `apps/webClient/src/infrastructure/api.config.ts:24-28` (request side) — register a **request** interceptor (not response) that:
  1. Reads `localStorage.accessToken`. If set, attaches `Authorization: Bearer ${accessToken}` header on every request.
  2. Sets `X-Device-Id` header to `localStorage.bgDeviceId` (generated once on first install — see T3.5).
  3. Does NOT remove the `withCredentials: true` flag — the cookie path still contributes (in case it works for some users).
- [ ] **T3.2 [P]** Edit `apps/webClient/src/infrastructure/api.config.ts:46-83` (response side) — extend the existing 401 handler so that on a successful login it:
  1. Reads `data.accessToken` and `data.refreshToken` from the response body.
  2. Writes both to `localStorage` (`accessToken`, `refreshToken`).
  3. Calls `await Cookies.set('accessToken', value, baseUrl);` and the same for refreshToken (Phase-2 shim absorbs the runtime mismatch).
  4. Returns the original response unchanged for downstream callers.
- [ ] **T3.3 [P]** Edit the existing `_retry`/refresh-fail cleanup at `apps/webClient/src/infrastructure/api.config.ts:71-74` — instead of `window.location.href = ${RoutePaths.Auth}/${RoutePaths.Login}` (which silently strands the user), show a `react-hot-toast` "Sesión cerrada por seguridad" and only redirect on next tick after the toast resolves. Avoids the visible-"blanco con 429" symptom from the user's trace.
- [ ] **T3.4** Edit `apps/webClient/src/application/auth/auth.service.ts:30-35` (`login`) — explicitly call `await Cookies.set(...)` for any manually-issued auth flow that bypasses the axios interceptor path (e.g., the `signup` page calls a different endpoint chain). Belt-and-suspenders so signup + login both go through the cookies-bridge.
- [ ] **T3.5** New `apps/webClient/src/infrastructure/device-id.ts` [NEW]. On first `device-id.ts` module load:
  1. If `localStorage.bgDeviceId` exists, return it.
  2. Otherwise generate `crypto.randomUUID()` if available (Android System WebView ≥ Chrome 92 ⇒ available). Fall back to a 12-byte hex v4 manual generator (using `crypto.getRandomValues`) if `randomUUID` is missing.
  3. Persist to `localStorage.bgDeviceId`.
  4. Export a tiny helper `getDeviceId(): string`.
- [ ] **T3.6** Edit `apps/webClient/src/infrastructure/api.config.ts:24-28` — call `getDeviceId()` from T3.5 in the request interceptor and emit `X-Device-Id: <uuid>` on every request. Backend read in T4.2.
- [ ] **T3.7** Edit existing `apps/webClient/tests/auth.spec.ts` — extend the spec faker to include body tokens in the mock `/auth/firebase-login` response. Assert `localStorage.accessToken` and `localStorage.refreshToken` are written after a successful login. Assert the second /auth/refresh request carries `Authorization: Bearer ${localStorage.accessToken}` (proving the request interceptor is wired).
- [ ] **T3.8** New `apps/webClient/tests/cookies-persistence.spec.ts` [NEW]. Playwright spec at `chromium-launch: { args: ['--disable-web-security'] }` simulates the WebView cookie-drop scenario:
  1. Login → assert `localStorage.accessToken` set.
  2. Fire `/api/v1/dashboard/summary` with the Authorization header → assert 200.
  3. Set `localStorage.accessToken = ''` (simulate expiry), leave `refreshToken`, fire `/auth/refresh` → assert 200.
  4. Assert no `Set-Cookie` header round-tripped (the disabled web security simulates the bug); the test passes (proving body-token path works).
- [ ] **Phase 3 gate** — `pnpm --filter frontend-web lint && pnpm --filter frontend-web test && pnpm --filter frontend-web build`. Frontend ready to send tokens via body OR Authorization header.

### Phase 4 — Backend throttle + tracker hardening

> Goal: the global ThrottlerModule does not strangle mobile CGNAT users when a single user retries refresh.

- [ ] **T4.1** Edit `apps/api/src/adapters/auth/http/auth.controller.ts:436` (`refreshToken` route) — add `@SkipThrottle()` decorator. Mirrors the line at L317 on `/auth/logout`. Refresh is on a known cadence (≤ 1× per access-token lifetime); the 4-rps global limit is a UX hazard for cold-starts.
- [ ] **T4.2** Edit `apps/api/src/app.module.ts:60-62` (`getTracker`) — extend the tracker priority: `req.headers['x-device-id'] || req.socket.remoteAddress`. Already-currently prioritizes `x-device-id`. **No change needed** in code; verifies the comment is correct. (If the comment is wrong, fix the comment — T4.3.)
- [ ] **T4.3 [P]** Edit `apps/api/src/app.module.ts:55-72` — replace the `getTracker` fallback chain with a more explicit version: `(req: any) => req.headers['x-device-id'] ?? req.ips?.[0] ?? req.socket.remoteAddress`. The `req.ips[0]` leg uses `app.set('trust proxy', 'loopback')` already in place at `apps/api/src/main.ts:111`; falls back to remote address last.
- [ ] **T4.4** New `apps/api/src/infrastructure/log/logger.service.ts` decoration (or extend existing) — emit a `🛡️ Refresh request origin: <ip> device-id: <uuid> | path: /auth/refresh` line on every `/auth/refresh` request, so production grep of failure patterns distinguishes mobile-vs-web refresh storms.
- [ ] **T4.5 [P]** Edit `apps/api/test/auth-throttle.e2e-spec.ts` — add a test case: same IP, with `X-Device-Id: device-a` and `X-Device-Id: device-b` are isolated throttler buckets. Same IP without header falls to the IP bucket (legacy path preserved).
- [ ] **Phase 4 gate** — `pnpm --filter api lint && pnpm --filter api test`. Backend throttle + tracker hardened.

### Phase 5 — Docs, manual verification, release wiring

> Goal: changelog and knowledge entries reflect the change. Manual device verification recorded. Operator-side actions listed.

- [ ] **T5.1** Edit `docs/changelog.md:5` — prepend `[v1.3.0] — 2026-06-26` with:
  - **Added** — `@capacitor-community/cookies` plugin, `X-Device-Id` request header, body-token fields on `/auth/{login,signup,firebase-login,refresh}`.
  - **Fixed** — APK users unable to retain session past access-token expiry (Android WebView third-party cookie policy).
  - **Changed** — `/auth/refresh` exempt from global throttle (4-rps cap was unhelpful for the fixed mobile cadence).
  - **Why a minor (not patch)** — per `knowledge.md §16.1`: new plugin + new contract fields + behaviour change constitutes a minor bump.
- [ ] **T5.2 [P]** Edit `knowledge.md:13.3 Known Technical Debt` — append: `Capacitor Android third-party cookie policy — incremental fix via cookies plugin, see rpi/mobile-cookies-persistence/`. Resolves the previously-undocumented "Android WebView does its own third-party cookie thing" risk.
- [ ] **T5.3** Manual verification on real device (gating for release):
  - Build APK: `pnpm --filter mobile build && cd apps/mobile && npx cap sync`. Then `cd apps/mobile/android && ./gradlew assembleRelease` (operator-side, native env).
  - Install: `adb install -r app-release.apk`.
  - Login flow: tap Google → bottom-sheet → pick account → land in app.
  - Spring background, kill via Settings → Apps → BG, relaunch → confirm user lands on Dashboard (not Login). 
  - Inspect via `chrome://inspect/#devices` → Application ▸ Cookies: confirm the cookies-plugin wrote the cookies, NOT the WebView's JS-level store. (This is the architectural difference that makes the fix work.)
- [ ] **T5.4** Update `.github/workflows/build-apk.yml` — verify `VITE_GOOGLE_WEB_CLIENT_ID` etc. continue to pass through; no env addition required for the cookies plugin (it has no env config).
- [ ] **T5.5** Verify `pnpm --filter mobile sync` regenerates `apps/mobile/android/app/src/main/assets/capacitor.plugins.json` with `@capacitor-community/cookies` listed. If missing, ad-hoc clean `pnpm install --frozen-lockfile=false` + re-`cap sync`.
- [ ] **Phase 5 gate** — `pnpm build` + the device smoke checklist in T5.3.

## Code References

### New files

```
apps/api/test/auth-cookie-bridge.spec.ts                                  [NEW]
apps/webClient/src/infrastructure/capacitor-cookies.ts                    [NEW]
apps/webClient/src/infrastructure/device-id.ts                            [NEW]
apps/webClient/tests/cookies-persistence.spec.ts                           [NEW]
rpi/mobile-cookies-persistence/research.md                                 [NEW — this artifact]
rpi/mobile-cookies-persistence/plan.md                                    [NEW — this artifact]
```

### Files to edit

```
apps/api/src/adapters/auth/http/auth.controller.ts:178-189                 [T1.1 firebase-login return shape]
apps/api/src/adapters/auth/http/auth.controller.ts:243-258                 [T1.2 signup docstring]
apps/api/src/adapters/auth/http/auth.controller.ts:297-301                 [T1.3 login return shape]
apps/api/src/adapters/auth/http/auth.controller.ts:436-465                 [T1.4 refresh return shape; T4.1 SkipThrottle]
apps/api/src/adapters/auth/http/auth.controller.ts:436                    [T4.1 @SkipThrottle() decorator]
apps/api/src/app.module.ts:55-72                                          [T4.3 getTracker normalization + comments]
apps/api/src/app.module.ts:161-170                                         [T1.5 cookieOptions maxAge 15→30 min]

apps/api/test/auth-service.spec.ts                                         [T1.6 response-body assertions]
apps/api/test/auth-throttle.e2e-spec.ts                                    [T4.5 X-Device-Id per-device buckets]

apps/mobile/package.json:11                                                [T2.1 cookies plugin]
apps/mobile/capacitor.config.ts:30-44                                      [T2.3 plugins.Cookies block]

apps/webClient/src/main.tsx                                                [T2.7 Cookies.init]
apps/webClient/src/infrastructure/api.config.ts:24-28                      [T3.1 request interceptor; T3.6 X-Device-Id]
apps/webClient/src/infrastructure/api.config.ts:46-83                      [T3.2 response interceptor body tokens; T3.3 toast before redirect]
apps/webClient/src/application/auth/auth.service.ts:30-35                  [T3.4 explicit Cookies.set on login/signup path]
apps/webClient/tests/auth.spec.ts                                           [T3.7 mock body tokens + assert localStorage]

docs/changelog.md:5                                                        [T5.1 v1.3.0 entry]
knowledge.md:13.3                                                          [T5.2 known-debt entry]
```

### Migration of native config

```
apps/mobile/android/app/src/main/assets/capacitor.plugins.json             [REGEN via 'pnpm --filter mobile sync']
.apps/mobile/android/app/src/main/assets/capacitor.config.json              [REGEN via 'pnpm --filter mobile sync']
```

## Testing Plan

| Layer | Approach |
|-------|----------|
| **Unit (backend Jest)** | T1.6 — extend every existing auth-flow spec to assert the response body has tokens. T1.7 adds a cross-cutting spec verifying that BOTH Set-Cookie and body tokens are present. T4.5 adds a per-device throttle-isolation spec. |
| **E2E (Playwright)** | T3.7 — extends `apps/webClient/tests/auth.spec.ts` to assert `localStorage` write. T3.8 — new `cookies-persistence.spec.ts` runs with `--disable-web-security` Chromium flag (which simulates the Android WebView third-party cookie block). Both specs gate the fix end-to-end without any device. |
| **Manual device smoke** | T5.3 — APK on real Android. Verifies: login → cold-kill → relaunch → still authenticated (the most important user-visible behavior change). |
| **Visual / manual UI** | After Phase 3, the "session expired" toast (from T3.3) replaces the silent redirect. Spot-check on web SPA confirms the toast appears on natural expiry — not on every refresh. |
| **Lint/build gates** | After every relevant task: `pnpm --filter api lint && pnpm --filter api test` (backend tasks); `pnpm --filter frontend-web lint && pnpm --filter frontend-web test` (frontend tasks). Phase gates add `pnpm build`. Phase 5 gate adds `pnpm --filter mobile sync` and the device smoke. |
| **Regression coverage** | Confirm existing `transaction-form.spec.ts`, `i18n.spec.ts`, `home.spec.ts`, `currency-conversion.spec.ts`, `offline-queue.spec.ts`, `income-merger.spec.ts` continue to pass. The auth flow changes are confined to `firebaseLogin`/`login`/`signup`/`refresh` so they're isolated. |
| **Cleanup invariant** | After every task: `rg 'X-Device-Id|bgDeviceId|CapacitorCookies' apps/webClient/src --type ts --type tsx` should NOT introduce orphan references (the request and response interceptor are the only callers). |

## FACTS Scale Output

| Dimension | Score | Justification |
|-----------|-------|---------------|
| **Feasibility (F)** | 5 | All tasks use existing patterns: NestJS controller return-shape edits (the `apps/api/src/application/auth/auth.service.ts:362-381` `oauthLogin` already returns tokens), `@capacitor-community/cookies` follows the same `@capgo/capacitor-social-login` install-validate-shim pattern already in the repo (Phase 2 mirrors Phase's Phase 3 of the mobile-apk RPI), axios interceptor extension matches the existing 401-handler pattern in `apps/webClient/src/infrastructure/api.config.ts:46-83`, decorators (`@SkipThrottle`) already used at lines 169, 317, 320. No third-party service adds, no native code changes. |
| **Atomicity (A)** | 5 | Each task is single-file or single-line (T4.1 is one decorator line). T2.6 creates one ~30-line TS file. T3.7/3.8 are spec files. No task spans > 3 files. |
| **Clarity (C)** | 4 | Paths and line ranges are precise (verified against live file tree). One small uncertainty: line numbers in `apps/api/src/adapters/auth/http/auth.controller.ts` may shift slightly after Phase 1 edits; adjust by `rg` at execution time. The `apps/mobile/capacitor.config.ts:30-44` block is the current `plugins` block — the `Cookies` insertion point is unambiguous. |
| **Testability (T)** | 5 | Spec T1.6/T1.7 cover the controller end of the contract. T3.7/T3.8 cover the frontend end. `--disable-web-security` simulates the Android WebView cookie-block deterministically, so the spec is reproducible. Device smoke in T5.3 catches any WebView-vs-Chromium divergence. |
| **Size (S)** | 5 | Phases balanced: P1=7, P2=7, P3=8, P4=5, P5=5. No task > 1 file. Largest is T2.6 (~30 LOC, one TS), T3.1+T3.2+T3.6 (one existing file + three edits), T1.7 (one new spec, ~120 LOC). |
| **Mean** | **4.80** | **PASS** (≥ 3.00) |

```
F: 5  A: 5  C: 4  T: 5  S: 5  Mean: 4.80  --> PASS
```

## Dependencies & Sequencing

```
Phase 1 ─── Phase 1 gate ───► Phase 2 ─── Phase 2 gate ───► Phase 3 ─── Phase 3 gate ───► Phase 4 ─── Phase 4 gate ───► Phase 5 ─── Phase 5 gate (launch readiness)
  │                            │                            │                            │                            │
  │                            │                            │                            │                            │
Backend returns tokens in   Cookies plugin installed +  Interceptor persists tokens +  SkipThrottle on /auth/     Docs + manual device
body (async-safe).          shim ready.                 Authorization fallback.       refresh + throttle tracker       verification + changelog.
Web SPA unchanged.         Web SPA no-op path.          Mobile path can survive.      hardening + per-device bucket.   Soft launch.
```

Critical-path constraints:

- **T1.1–T1.4 must land before T3.2** — the frontend interceptor reads token fields from response bodies. Backend must ship them first.
- **T2.6 must land before T3.1/T3.2** — both interceptors call `Cookies.set/get`. Without the shim, web SPA fails.
- **T3.5 must land before T3.6** — `device-id.ts` must exist before the request interceptor reads from it.
- **T4.1 must land AFTER Phase 3 is on prod** — otherwise a stuck refresh + throttle = lockout (during Phase 4 deploy, a brief window where refresh is body-token but throttle still applies could amplify 429s for a single bad network). Acceptable behind a feature flag: decode `X-Device-Id` server-side and use it as a co-tracker **first** (T4.3), and only after Phase 3 ships does T4.1 land.
- **T5.3 device smoke in CI** — Capacitor + Gradle is not in the hosted sandbox per `docs/changelog.md` v1.2.0 quality-gates note ("🟡 Native `./gradlew assembleRelease` not executed in this sandboxed environment — run locally + on CI to confirm gradle resolves …"). T5.3 is operator-deliverable.

Parallel-execution opportunities (within a phase):

- **T1.1/T1.2/T1.3/T1.4 are independent** — same file, but each method's return shape is method-local; writing all four in one pass is trivial. (Marked `[P]` in spirit — execution can be one editor session.)
- **T2.1/T2.3/T2.4/T2.7 are independent (different files)** — `[P]`.
- **T3.1/T3.2/T3.6 are all edits to the same file** — sequence them in the order above.
- **T3.4 is independent** — different file.
- **T3.7/T3.8 are independent** — different files.

External dependencies: **none**. No webhook, payment, third-party service. Backend-only, frontend-only, plugin-only.

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| `@capacitor-community/cookies` peer-dep rejects Capacitor 7 → install fails | Medium | Phase 2 halts | T2.1 → T2.2 fallback chain: try `^6`, on resolution failure try `^7.0.0` (latest). If both fail, fall back to **no cookies plugin**, and body-token + Authorization path alone (T3 alone, skipping T2). |
| Samsung Internet WebView blocks plugin writes (vendor divergence) | Low | Mobile Samsung users still hit the bug | A `setAcceptThirdPartyCookies` flag would require a custom Capacitor Java plugin (out of scope). Mitigation: device smoke matrix (T5.3) lists Samsung as a known-skip group; flagged for a followup RPI. |
| Body-token return shape breaks the existing web SPA login (e.g., a Playwright spec asserts no body tokens) | Low (our existing web SPA uses `data.user`) | Existing tests fail | All existing tests verify only `data.user` / `data.message`. Adding tokens is additive. Phase 1 gate (T1.6) catches regressions before frontend rollout. |
| `crypto.randomUUID()` unavailable on Android System WebView < Chrome 92 | Low (Chrome 92 = late 2021; today's Android WebView ≥ Chrome 119) | Device-id polyfill kicks in | T3.5 explicitly polyfills via `crypto.getRandomValues` if `randomUUID` is undefined. 8 extra lines. |
| `X-Device-Id` opens a tracking concern (privacy / GDPR) | Medium | Product / DPO concern | The ID is generated client-side and stored only in `localStorage`; not transmitted to a third party; the user's setting UI should disclose it. Add `routes.user.privacy` tooltip in a follow-up RPI; current fix does NOT change privacy posture because the IP-fallback is also an identifier. |
| `Authorization: Bearer` header on the existing browser fetch path breaks cookies replay (e.g., CORS rejects the new header) | Low | Browser users stop refreshing | Backend ALREADY allowlists `Authorization` in `apps/api/src/main.ts:99` (`allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']`). |
| `npx cap sync` regenerates `apps/mobile/android/app/src/main/java/com/budgetgenius/mobile/MainActivity.java` and overwrites our SocialLogin wiring | Low | Mobile Google login regresses | Phase 2 explicitly verifies MainActivity remains untouched (T2.5). If a Capacitor release ever starts auto-generating MainActivity, we add a gradlew-warning hook + a regression spec. |
| Tokens in response body increase payload by ~600 bytes × 3 flows | Negligible | Negligible | Trivial. Login flow is non-RPS-bound. Middleware gzip compresses anyway. |
| `apps/api/.env.production.example` (if it exists as a tracked file) needs a `Skipping throttle` config — actually `@SkipThrottle` is decorator-side, no env | Low | Operator confusion | Add inline comment at T1.5 + T4.1 explaining the decorator-only nature. |
| Phase 4 deploys before Phase 3 / Phase 1 complete → stuck users with broken refresh + still global-throttled | Medium | 4xx storm of "no refresh token" + 429s for a single bad network | Gate Phase 4 deploy behind Phase 1+2+3 green Playwright + manual smoke. Release order is enforced by PR-ci requirements, not deferred to operator judgment. |

## Rollback Strategy

| Phase | Rollback Procedure |
|-------|--------------------|
| **Phase 1** | `git revert <phase-1-commit>`. Response shape reverts to `{user, message}` / `{accessToken, refreshToken, user, isNewUser, message}` (signup had tokens already). No DB-side migration in Phase 1. **Zero DB-impacting rollback.** |
| **Phase 2** | `pnpm remove @capacitor-community/cookies` + `git revert` the `capacitor.config.ts` block edit + remove `apps/webClient/src/infrastructure/capacitor-cookies.ts`. **Reversible in < 2 minutes.** Phase 1 still gives the body-token path as a fallback for the body-token-only work; on failure to commit Phase 2, Phase 1's body tokens already help slightly (frontend interceptor in Phase 3 must also be reverted). |
| **Phase 3** | `git revert <phase-3-commit>`. The request/response interceptor change reverts in lockstep. **No data loss; frontend uses legacy flow again** — but legacy flow is the broken-mobile flow, so revert is a temporary measure until Phase 2 is re-attempted. |
| **Phase 4** | `git revert <phase-4-commit>`. The `@SkipThrottle()` decorator and `getTracker` change revert in one commit. **No data loss.** |
| **Phase 5** | N/A — docs only. Reverting a docs commit is trivial. Note: a release that **did** T5.1 (bump to v1.3.0) should be re-released as v1.3.1 with the revert in the changelog — release process per `knowledge.md §16 Release Workflow`. |

### Recovery dataset

- No DB schema changes in this RPI — recovery granularity is per file.
- Git history is the single source of truth for the rollback. No snapshot tables or external artifacts to coordinate.

### Postmortem trigger conditions

A `plan-postmortem.md` is generated at `rpi/mobile-cookies-persistence/plan-postmortem.md` if:

- Phase 1 + Phase 2 deployed but Phase 3 introduces a runtime regression that cannot be fixed without reverting Phase 2 (the cookies plugin + body tokens are both needed for the mobile path; if Phase 3 fails, the mobile app is stuck on its current broken state).
- The `cookies-persistence.spec.ts` Playwright spec passes locally but device smoke (T5.3) reveals a vendor-specific WebView divergence (Samsung Internet, MIUI Browser, etc.) and the team's existing remote-debug backlog can't catch it.
- `pnpm --filter api test` fails on any of the new specs (T1.6 / T1.7 / T4.5) on the second retry (first is "Minor" per `docs/rpi/Implement.md`).

## Reference

- Research artifact: `rpi/mobile-cookies-persistence/research.md` (FAR Mean = 4.67, PASS).
- Framework: `docs/rpi/Research.md`, `docs/rpi/Plan.md`, `docs/rpi/Implement.md`.
- External sources cited: `github.com/capacitor-community/cookies` README, `developer.android.com/reference/android/webkit/CookieManager`, `developer.chrome.com/docs/privacy-sandbox/storage-access-api/`, `developer.mozilla.org/en-US/docs/Web/API/Storage_Access_API`.
- Project conventions: `@capgo/capacitor-social-login` install pattern (mirror); clean-architecture aliases; PNPM + Turbo workspace.
- Quality gates: `pnpm --filter api lint && pnpm --filter api test && pnpm --filter frontend-web lint && pnpm --filter frontend-web test && pnpm build && pnpm --filter mobile sync`.
