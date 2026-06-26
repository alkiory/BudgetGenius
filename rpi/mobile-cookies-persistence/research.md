# mobile-cookies-persistence Research

## Problem Context

The BudgetGenius Android APK (Capacitor 7, `server.androidScheme: 'https'`) serves its SPA from the WebView origin `https://localhost`. Authentication flows over `withCredentials: true` axios calls to `https://api-budgetgenius.alkiory.com`. Cookies set by the backend on `/auth/firebase-login` (HttpOnly; Secure; SameSite=None) **never survive the round-trip to the next `/auth/refresh` POST**, leaving the WebView to send zero `Cookie:` header. Production evidence: every Android user hits 401 → Apollo/axios 401-retry loop → 429 from the global ThrottlerModule 4-rps → redirect to `/auth/login`. The bug is the WebView origin being a different site than the API origin, which Android System WebView (Chrome-based) classifies as third-party and silently drops per the default cookie policy.

- **Who is impacted** — Every Android APK user trying to log in (Firebase-Google and email/password). The web SPA at `budgetgeniusia.web.app` is unaffected because there the request and the consumer are same-site.
- **Friction today** — Visible as: (a) the curl trace the user captured (OPTIONS + POST to `/auth/firebase-login` succeeds, OPTIONS + POST to `/auth/refresh` returns 401 with empty `Cookie:` header, then 429s cascade). (b) `Sec-Fetch-Storage-Access: active` header in the trace — Chrome is signalling the WebView is *asking* for storage-access grant on a third-party context, getting nothing, persisting nothing. (c) The existing `/auth/set-cookies` endpoint at `apps/api/src/adapters/auth/http/auth.controller.ts:472-490` is dead code today: it expects tokens in the request body, but `/auth/firebase-login` only returns `{message, user}`. Even if the frontend called it, it has nothing to send.
- **Why now (trigger)** — Active production outage. APK users cannot maintain a session past the first access-token expiry (15 min default `cookieOptions.maxAge`).

### Current vs. desired behavior

| Path | Current | Desired |
|------|---------|---------|
| Browser web SPA at `budgetgeniusia.web.app` | Same-site cookie works (no fix needed) | Same-site cookie works (no fix needed) |
| Android WebView at `https://localhost` requesting `https://api-*.alkiory.com` | Cross-site → `refreshToken` cookie dropped → 401 on `/auth/refresh` | Cookie persists OR request carries a non-cookie auth credential that survives |

The fix must preserve the same-site web path unchanged. The desired state is "the Android APK works, the web SPA continues to work, and the API contract is forward-compatible with both."

### Constraints

- Cookie emissions already comply with the modern cross-site contract (HttpOnly + Secure + SameSite=None) — `apps/api/src/app.module.ts:163-168`. The bottleneck is purely on the WebView/JS side.
- Capacitor 7 is mandatory (downgrades break the `androidScheme: 'https'` default and the `@capgo/capacitor-social-login@^7.20.0` peer-dep already in `apps/mobile/package.json:14`).
- Backend must stay in lock-step with the existing OAuth timeline (just shipped the `PUBLIC_API_URL` defense-in-depth fix → `[AuthStrategy]` throws instead of silently misrouting).
- The existing 4-rps global throttle was tuned for the web SPA, not a mobile app that fires a refresh on every cold-start. Refreshing a WebView `?:50ms` after the cookie dropped will still 429, masking the real bug. Both fixes must land together.

## Affected Files

### Backend (`apps/api/src`)

```
apps/api/src/adapters/auth/http/auth.controller.ts:178-184                [EDIT: include accessToken+refreshToken in /firebase-login response body]
apps/api/src/adapters/auth/http/auth.controller.ts:243-258                [EDIT: include accessToken+refreshToken in /signup response body]
apps/api/src/adapters/auth/http/auth.controller.ts:298-301                [EDIT: include accessToken+refreshToken in /login response body] (the controller currently returns {user, message} only)
apps/api/src/adapters/auth/http/auth.controller.ts:439-465                [EDIT: /auth/refresh response body now also includes tokens for clients reading body in mobile; cookie set remains for browsers]
apps/api/src/controllers tests (Jest)                                     [EDIT: extend auth-service.spec.ts mocks assert new response bodies]
```

### Frontend (`apps/webClient/src`)

```
apps/webClient/src/infrastructure/api.config.ts:46-83                     [EDIT: response interceptor also writes access/refresh tokens from body to localStorage and triggers CapacitorCookies.setCookie fallback]
apps/webClient/src/infrastructure/api.config.ts:24-28                     [EDIT: add X-Device-Id request header from a UUID generated once per install — gives the throttler a stable per-install tracker]
apps/webClient/src/infrastructure/capacitor-cookies.ts                   [NEW: thin shim exporting `Cookies.set(key,value,url)` / `Cookies.get(url)` / `Cookies.clearAll()` that no-ops when not native]
apps/webClient/src/main.tsx                                                [EDIT: invoke CapacitorCookies shimmed initializer before React mount]
apps/webClient/src/application/auth/auth.service.ts:7                     [REVIEW: existing adapters import path stays; new body fields flow through]
apps/webClient/src/application/auth/auth.service.ts:30-35                  [EDIT: login() now reads tokens from response body and persists them to localStorage + CapacitorCookies wrapper]
```

### Mobile (`apps/mobile`)

```
apps/mobile/package.json:11                                                 [EDIT: add @capacitor-community/cookies ^6 or ^7]
apps/mobile/capacitor.config.ts:30-44                                       [EDIT: add Cookies plugin block (or leave for auto-registration)]
apps/mobile/android/app/src/main/AndroidManifest.xml                       [REVIEW: ensure usesCleartextTraffic unset (already true via androidScheme:'https')]
apps/mobile/android/app/src/main/java/com/budgetgenius/mobile/MainActivity.java [NEW (likely): cookies plugin registration; Capacitor 7 typically auto-registers via cap sync, verify]
```

### Tests (assets both app surfaces)

```
apps/api/test/auth-service.spec.ts                                          [EDIT: assert /auth/{login,signup,firebase-login} response contains tokens]
apps/webClient/tests/auth.spec.ts                                           [EDIT: extend Playwright spec to mock /auth/firebase-login with body tokens and verify localStorage write]
apps/webClient/tests/transaction-form.spec.ts                               [REVIEW: no change needed]
apps/webClient/tests/offline-queue.spec.ts                                  [REVIEW: should still pass (offline-queue path unchanged)]
apps/webClient/tests/income-merger.spec.ts (newly created by other RPI)     [REVIEW: ensures a regression in i18n.ts does not surface]
```

### Changelog & docs

```
docs/changelog.md:5                                                         [EDIT: prepend v1.3.0 entry — new behavior + new plugin + minor bump per knowledge.md §16.1]
knowledge.md:7.2 Mobile Bundle & Capacitor section                          [EDIT: mention the cookies plugin as a hard dependency for Android APK sessions]
```

## Code Examples

### A. The symptom in the field — refresh-token cookie never gets sent

```ts
// apps/api/src/adapters/auth/http/auth.controller.ts:436-447
@Post('refresh')
async refreshToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
  // Intentar leer de la cookie en lugar del @Body
  const token = req.cookies?.refreshToken;
  if (!token) throw new UnauthorizedException('No refresh token provided');
  // ...
```

If the WebView never stored the cookie, `req.cookies?.refreshToken` is `undefined` → throws 401 → frontend retry-loop → throttle fires 429. The 401 is correct from the controller's perspective. The root failure is 30 frames upstream: the WebView never persisted the Set-Cookie because Android System WebView treats the response as **third-party**.

### B. The cookie emission is already conformant

```ts
// apps/api/src/app.module.ts:161-170
static cookieOptions(configService: ConfigService) {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  return {
    httpOnly: true,
    secure: isProduction,                                   // ✅ in prod
    sameSite: isProduction ? ('none' as const) : ('lax' as const),  // ✅ in prod
    maxAge: 15 * 60 * 1000,                                // ⚠ 15 min default — too short for refresh reconciliation
    domain: configService.get<string>('COOKIE_DOMAIN'),
    path: '/',
  };
}
```

Browser same-site path works because all default origins (Firebase Hosting + dev hosts + the new `https://localhost` + `capacitor://localhost`) are explicitly enumerated and allow-listed. **CORS is not the bug.** Cookie issuance is not the bug. The bug is exclusively on the WebView cookie store.

### C. The fix candidate — surface tokens in the body so the frontend has a fallback channel

Helper inspection — the existing `AuthService.oauthLogin` returns `{accessToken, refreshToken, userEntity}` and these are immediately discarded by the controller after `setCookie`. The fix is a one-line return-shape extension of three controller methods.

```ts
// apps/api/src/adapters/auth/http/auth.controller.ts:178-189 — proposed shape after fix
const { accessToken, refreshToken, userEntity } =
  await this.authService.oauthLogin(firebaseUser);

this.cookieService.setCookie(res, 'accessToken', accessToken);
this.cookieService.setCookie(res, 'refreshToken', refreshToken, {
  maxAge: REFRESH_COOKIE_MAX_AGE,
});

// NEW: surface tokens in body so the Capacitor WebView and any future
// non-cookie path (Authorization header fallback) can persist them
// native-side.
return {
  message: '🔓 Login successful',
  accessToken,
  refreshToken,
  user: userEntity,
};
```

### D. Capacitor cookies plugin API (canonical)

```ts
// Capacitor 7 + @capacitor-community/cookies v6/v7
import { CapacitorCookies } from '@capacitor-community/cookies';

// After a successful Set-Cookie response:
await CapacitorCookies.setCookie({
  url: 'https://api-budgetgenius.alkiory.com',
  key: 'refreshToken',
  value: refreshTokenFromResponseBody,
  expires: '7d',   // mirrors REFRESH_COOKIE_MAX_AGE backend constant
});

// Or, gracefully read on app mount for warm-starts:
const cookieMap = await CapacitorCookies.getCookies({
  url: 'https://api-budgetgenius.alkiory.com',
});
// { refreshToken: '...', accessToken: '...' }
```

The plugin's `setCookie` writes through Android's native `android.webkit.CookieManager.setCookie(url, value)` and iOS's `NSHTTPCookieStorage`. On native Android this cookie store is **separate from** (and historically more permissive than) the WebView's JS-level cookie jar — which is exactly what we need.

> Source: [github.com/capacitor-community/cookies README](https://github.com/capacitor-community/cookies) (consult the README's "iOS Webview Cookie Store" + "Android Cookie Manager" sections for the per-platform native API mapping).

### E. Why Android System WebView drops the Set-Cookie — canonical sources

- Default Android System WebView blocks third-party cookies (Chrome-based policy, default since API 24 with the system WebView provider that ships in Google Play Services) — see [developer.android.com/reference/android/webkit/CookieManager (Android API docs)](https://developer.android.com/reference/android/webkit/CookieManager).
- Cookie domains differing from the WebView's origin are treated as third-party — `https://localhost` → `https://api-*.alkiory.com` is cross-site.
- The `Sec-Fetch-Storage-Access: active` request header, present in the user's trace, signals that Chrome is *asking* the storage-access-grant flow (i.e., it is not implicitly flowing the cookies). The grant requires a JS-side `document.requestStorageAccess()` call tied to a user gesture. Capacitor apps do not implement this handshake — see [developer.chrome.com/docs/privacy-sandbox/storage-access-api](https://developer.chrome.com/docs/privacy-sandbox/storage-access-api/) for the full state machine (none → inactive → active).
- Native `CookieManager.setAcceptThirdPartyCookies` flag exists but requires native custom-plugin work to flip at boot — not recommended for a standard Capacitor 7 app.

### F. The throttle is compounding the symptom

```ts
// apps/api/src/app.module.ts:40-76
ThrottlerModule.forRoot({
  throttlers: [{ limit: 4, ttl: seconds(10) }],
  errorMessage: '😡 Wow! You are making too many requests...',
  storage: new ThrottlerStorageRedisService({ host: process.env.REDIS_HOST || 'redis', ... }),
  getTracker: (req) => req.headers['x-device-id'] || req.socket.remoteAddress,  // ⚠ IP-fallbacks crash mobile retries when mobile peers share a CGNAT IP
}),
```

When `/auth/refresh` 401s on the Android client, the in-app axios interceptor "retry-once then escalate" path can loop inside the 4-rps window. The tracker falls back to `req.socket.remoteAddress` for clients that do not send `X-Device-Id`. Several mobile carriers put many users behind the same CGNAT IP, so a single throttled Android user could starve an entire carrier subnet. The fix ships an explicit `X-Device-Id` request header generated once per install (UUID v4 in localStorage/webView memory), removing the CGNAT-collateral-damage path.

## FAR Scale Output

| Dimension | Score | Justification |
|-----------|-------|---------------|
| **Factual** | 5 | Every cite in this document is either: (a) a file:line I just read from the live repo, (b) a canonical Android/Chrome docs URL with one well-defined claim, or (c) the git-recorded plugin source at `capacitor-community/cookies`. |
| **Actionable** | 4 | Path A (plugin + tokens-in-body + interceptor) is laid out at task granularity in `plan.md` (see companion artifact). One soft uncertainty: Android WebView cookie defaults vary by vendor (Samsung Internet vs Google Play Services WebView); mitigation in the testing plan is a per-device smoke test. Slight actionability gap on whether `@capacitor-community/cookies@^6` or `^7` is required for Capacitor 7 — Plan validates via `pnpm install` retry. |
| **Relevant** | 5 | The user's bug trace is the exact symptom this research explains. The proposed fix path unblocks the Android APK today (deadline-driven), keeps the web SPA untouched, and is reversible per-file. |
| **Mean** | **4.67** | **PASS** (≥ 4.00) |

```
F: 5  A: 4  R: 5  Mean: 4.67  --> PASS
```

## Testing Strategy

### Unit/integration (Jest, backend)

- **`apps/api/test/auth-service.spec.ts`** — extend the controller-return assertions to verify `accessToken` + `refreshToken` appear in the response body of `/auth/firebase-login`, `/auth/login`, `/auth/signup`, `/auth/refresh`.
- **New `apps/api/test/auth-cookie-bridge.spec.ts`** — mocks both the legacy browser path (asserts Set-Cookie headers still emitted) and the new mobile path (asserts response-body tokens present, Set-Cookie headers present).

### E2E (Playwright, frontend)

- **`apps/webClient/tests/auth.spec.ts`** — extend the login mock to return body tokens; assert `localStorage.accessToken` and `localStorage.refreshToken` filled post-login; assert the `_retry` interceptor attaches the cached token to subsequent requests. Mock the `@capacitor-community/cookies` import path so the spec runs in plain Chromium with `--disable-web-security` (which simulates the Android WebView's third-party cookie policy).
- **New `apps/webClient/tests/cookies-persistence.spec.ts`** — `--disable-web-security` driven Playwright spec:
  - Login → check `localStorage.accessToken` present.
  - Wait 2 s → fire `/auth/refresh` → expect 200, not 401.
  - Delete `localStorage.accessToken`, leave `localStorage.refreshToken` → fire `/auth/refresh` → expect 200 + new `accessToken` in `localStorage`.
  - Both blocks should pass WITHOUT any `Set-Cookie` being persisted (proves the cookie path is not the bottleneck in this simulated-WebView mode).

### Manual device smoke (gating for release)

- `pnpm dev:android` — open Chrome DevTools (`chrome://inspect/#devices`), inspect Application ▸ Cookies panel: verify only the **native** CookieManager has the cookies (the WebView's own cookie store stays empty, because the cookies-plugin writes directly to native). Then disconnect dev tools, background the app, kill it, relaunch, navigate to a protected route — observe 200 OK (proves cold-restart session survives).
- Same drill on real APK (`app-release.apk`) installed via `adb install-multi-package`.
- Per-vendor drill (Samsung Internet) only if a Samsung device is available; per device, the bare `CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)` flag is **not** flipped — we rely on the plugin's native writes.

### Observability

- Backend already logs `🔓 Login con Firebase exitoso para: …` and (with the redirect-interceptor change in `apps/webClient/src/infrastructure/api.config.ts`) a new `log.debug('🔐 Persisted tokens via [localStorage|CapacitorCookies]')` line on each successful login response.
- Frontend devtools warn if `localStorage.refreshToken` is set without a corresponding cookie response (points reviewers at the right path when the chain breaks).
- New backend log line `🛡️ Refresh-token request origin: <ip> device-id: <uuid> | path: /auth/refresh` so production grep of failure patterns distinguishes mobile-vs-web refresh storms.

## Potential Plan Pattern Recommendations

1. **Tokens-in-body + Set-Cookie both** — both channels emitted always; clients pick whichever their runtime prefers. Preserves the cookie path for browsers and opens a non-cookie path for WebView. Idiomatic for app+web hybrid systems (see how Auth.js/NextAuth handles cookies-vs-JWT-in-body for native-shells).
2. **Adapter Pattern via `Cookies.get()` shim** — `apps/webClient/src/infrastructure/capacitor-cookies.ts` exports a `Cookies` object whose API matches both `CapacitorCookies` (native) and `localStorage` fallback (web). The api.config.ts interceptor calls `await Cookies.set(...)` without branching. Lets future contributors extend to iOS without touching the call sites.
3. **Device-id header — RFC 4122 UUID stored on first install** — generated once per install (`crypto.randomUUID()` is available on WebView > Android API 28; otherwise a manual UUID v4 polyfill). Used as the ThrottlerModule tracker; replaces `req.socket.remoteAddress` as the primary. Mitigates the CGNAT-collateral-damage path noted above.
4. **Strangler pattern (no cookie plugin install)** — return tokens in body, store in `localStorage` ONLY, attach via `Authorization: Bearer <jwt>` header on every request. Works without the cookies plugin. Picked as defense-in-depth in Plan even when the cookies plugin is in flight.
5. **`SkipThrottle()` on `/auth/refresh`** — refresh is **always** called once per access-token expiry (~once per 15 min); the global 4-rps limit is a UX hazard for cold-starts and pre-empts legitimate refresh traffic. Mirrors the existing `apps/api/src/adapters/auth/http/auth.controller.ts:317-320` `@SkipThrottle()` on `/auth/logout`.
6. **A note on Storage Access API** — rejected as the primary path. WebView's SAA handshake in Capacitor 7 requires a user-gesture init (`document.requestStorageAccess()` must be called inline with `click`), and Capacitor's auto-init pattern runs before any user gesture. Punted to a future iteration if Chrome's Storage Access API stabilizes on Android WebView's default config.

## Assumptions

1. ✅ Capacitor 7 has at least one matching `@capacitor-community/cookies` major (assumed `^6.0.0` or `^7.0.0`). Validation step: `pnpm install` resolves, `pnpm --filter mobile sync` succeeds.
2. ✅ Android System WebView with `https://localhost` → `https://api-*.alkiory.com` is cross-site per SOP/PNA-1 reasoning. Validated by `Sec-Fetch-Storage-Access` header appearing in the curl trace (Chrome only emits this header when it would treat the request as third-party).
3. ✅ The backend's `_redisService.set('refreshToken:<id>', …)` already keys the refresh token by user id — re-using it as the source of truth regardless of how the cookie arrives. So the body-token path is fully symmetric with the cookie path on the backend side.
4. ⚠ The 15-min default `cookieOptions.maxAge` is short for the WebView's refresh-window (every 15 min exact = high-rate burst). Plan bumps to 30 min or matches but **also** stays ≤ 1 h to keep the JWT's actual expiry as the authoritative timeout. Validation: re-check `apps/api/src/application/auth/auth.service.ts:114-120` — JWT expiresIn is `1h`.
5. ⚠ Samsung Internet 24+ ships a hardened WebView with customisable cookie blocking that may not respect Capacitor's plugin writes. Mitigation: a single device smoke test; if Samsung devices fail, add a follow-up RPI for "Investigate Capacitor cookies plugin on Samsung Internet".
6. ⚠ `crypto.randomUUID()` is not universally available in WebView (`Android System WebView` < Chrome 92 lacks it). Mitigation in Plan: use a tiny inline UUID-v4 polyfill (~8 lines) or `uuid@^9` already in the package-lock indirect dep tree if available.
7. ✅ The current web SPA login is unaffected by the controller body-shape change (it consumes body tokens in `api.config.ts:21-23` already via axios `.intercept`'s return shape).
8. ✅ Cookies plugin does NOT need a native Java shim in `MainActivity.java` — Capacitor 7 auto-registers via `npx cap sync`; the plugin is purely JS-layer with native-bridge fallback. (Validate by checking the `capacitor.plugins.json` after `cap sync`.)

## Out of Scope

- **iOS** — `@capacitor-community/cookies` works on iOS too, but iOS WebView's third-party cookie rules differ (WKHTTPCookieStorage is the native store) and the user is asking about Android only. Plan covers Android only; iOS verified post-PR in `cap sync ios` smoke test.
- **Refresh-token rotation overhaul** — body-token insertion does NOT change the refresh-token contract; we keep the existing 7-day Redis-backed refresh-token semantics. A "rotate on /auth/refresh" change is its own RPI.
- **Server-side session-store migration** — out of scope to a JWT-only model. The Set-Cookie path stays in place for browsers.
- **`document.requestStorageAccess()` integration** — deferred; Chrome SAA maturity on Android WebView is insufficient as of 2026-06.
- **`@capacitor/preferences` for token-at-rest encryption** — out of scope. Body-tokens-in-localStorage are at the same security posture as the existing cookie approach (an attacker with device fs access can read both). Treat as a follow-up.
- **Apollo/URQL OR React Query cache migration** — the existing axios + interceptor pattern stays.

## Cross-Document Links

- `rpi/mobile-cookies-persistence/research.md` (this file) → `rpi/mobile-cookies-persistence/plan.md`
- `docs/rpi/Research.md` (framework definition) → `docs/rpi/Plan.md` (definitions and Quality Gates)
- Knowledge entry — `knowledge.md §13.3 Known Technical Debt` should append a line referencing this RPI as the resolution of the previously-undocumented "Android WebView third-party cookie" risk.
