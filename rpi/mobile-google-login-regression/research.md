# mobile-google-login-regression Research

> Companion to `rpi/mobile-google-login-regression/plan.md` (downstream).
> Goal: produce a FAR-validated analysis of why the Google-Login native flow regressed between v1.6.0 and HEAD, and identify a single bounded contract change that decouples the "Account reauth [code=16]" SHA-1 misregistration case from the Web SDK fallback ladder — without disturbing the other fallback triggers.

## Problem Context

After commit `f3b7b8d` "fix: update webClient to use native google login strategy", a user on the Android APK who taps **Login with Google**, picks an account in the Credential Manager bottom sheet, and the WebView then **opens the system browser**, instead of completing the auth flow inside the app. In `v1.6.0` (tag `793643b`) the same flow completed inside the WebView with a toast on success or a Firebase error toast on failure — no browser ever opened.

The cause is in the *coupling* between two pieces of recent code:

1. `apps/webClient/src/adapters/auth/native-google-login.strategy.ts` introduced a matcher `isAccountReauthError(error)` (line 28) and a re-throw `buildAccountReauthRethrow(originalError)` (line 88) that wraps the original error with a `nativegoogle: Account reauth failed [code=16]...` prefix.
2. `apps/webClient/src/adapters/auth/index.ts` defines `HybridGoogleLoginStrategy.login()` (line 66). When `isNativePlatform()`, it calls Native first and on failure evaluates `error.message.includes("nativegoogle")` (line 84) against a list of trigger substrings. If any matches, it falls back to `WebGoogleLoginStrategy.login()`, which on native calls `signInWithRedirect(auth, provider)` (web-google-login.strategy.ts:62) → opens the phone's browser.

The net behavior: when `isAccountReauthError` fires on a Capacitor build, the matcher prefix collides with the Hybrid's fallback trigger substring. As a result the user gets bounced to `signInWithRedirect` rather than an actionable SHA-1-fingerprint error.

### Who is impacted

- **Operadores (no-ops team)** — cannot ship APK builds today without leaving users stranded in Chrome Custom Tabs. They already registered the SHA-1 per `apps/mobile/README.md` → 'Account reauth failed' but the app still kicks the user out.
- **End-users on Android** — every Google-login attempt from the APK opens the system browser. The redirect back to the app never lands (no OAuth deep-link intent filter in `apps/mobile/android/app/src/main/AndroidManifest.xml`), so the user sees a hanging Browser tab and must manually back-track.
- **Web SPA** (`budgetgeniusia.web.app`) — unaffected; the `isNativePlatform()` gate keeps the Web SDK path on signInWithPopup.

### What is the friction today

The fallback ladder `HybridGoogleLoginStrategy` is structured as a *substring message grep* — `msg.includes("not implemented")` / `msg.includes("no credentials available")` / `msg.includes("nativegoogle")` (index.ts:82-84). Every producer of an error with the literal substring "nativegoogle" is therefore implicitly re-routed to signInWithRedirect. The matcher that detects Account reauth [code=16] (added in f3b7b8d) is the **third** producer of `nativegoogle:` strings, after `web-google-login.strategy.ts:71` (`nativegoogle: signInWithRedirect failed: …`) and `native-google-login.strategy.ts:128` (`nativegoogle: SocialLogin.initialize failed: …`). Adding a fourth producer of `nativegoogle:` would re-introduce the same trap.

### Why now (trigger)

The reactive trigger: the user pushed the f3b7b8d commit to `main` (HEAD), exposed production users to the regression, and manually verified the SHA-1 per the documented playbook *without* effect — proving the matcher is firing on something other than the SHA-1 alone, OR firing fine but then being routed to the wrong surface.

The proactive trigger: any future feature that adds a `nativegoogle:` producer (or refactors the matcher to add error classes / codes) would re-trigger the broken fallback. Per `knowledge.md §6.8.*`, codifying this as a structural invariant with a clear TypeScript contract is the only line of defense against re-regression.

### Current vs. desired behavior

| Path | Current (HEAD) | Desired |
|---|---|---|
| Android APK, matcher fires (SHA-1 misregistration, transient error containing "account"+"reauth") | matcher rethrows with `nativegoogle:` prefix → Hybrid matches substring → calls Web SDK on native → `signInWithRedirect` → opens phone browser | matcher sets `(error as Error & { isAccountReauth?: boolean }).isAccountReauth = true` → Hybrid pre-check on that property rethrows → UI surfaces a modal explaining the 5-step SHA-1 playbook |
| Android APK, plugin throws "not implemented" / "no credentials available" | Hybrid substring match → Web SDK → browser opens | unchanged — Web SDK still acts as a true fallback for *unknown-plugin* states |
| Android APK, user cancels the bottom sheet | Hybrid rethrow (no substring match) → toast with raw message | unchanged |
| Web SPA, all paths | Web SDK signInWithPopup | unchanged |

### Constraints

- The `nativegoogle:` message-prefix stays in place for `apps/api/src/infrastructure/log/logger.service.ts` and any operator-facing grep on log files. Removing the prefix would orphan `apps/mobile/README.md` searches and Sentry breadcrumbs.
- The matcher `isAccountReauthError` is the defensive net for plugin versions that surface the error only via wrapped text. The matcher must not be widened (it already false-positives on text containing "account" + "reauth") and must not be narrowed to numerics-only (loses Branch 2 in the existing spec at `__tests__/native-google-login.strategy.spec.ts`).
- The fallback to Web SDK on true "plugin is not implemented here" must remain — the `mode: "online"` guard and `ensureSocialLoginInitialized` invariants are load-bearing for first-render init failures.

## Affected Files

### Frontend — `apps/webClient/src/`

```
apps/webClient/src/adapters/auth/native-google-login.strategy.ts:75-100             [EDIT: buildAccountReauthRethrow sets (err as Error & { isAccountReauth?: boolean }).isAccountReauth = true after the nativegoogle prefix; comment explains new contract]
apps/webClient/src/adapters/auth/index.ts:66-100                                    [EDIT: HybridGoogleLoginStrategy.login() checks error.isAccountReauth === true FIRST and rethrows; substring gate runs ONLY for isAccountReauth === undefined]
apps/webClient/src/adapters/auth/index.ts:71-72                                     [EDIT: extract class HybridGoogleLoginStrategy from module-local into its own file for testability; export it]
apps/webClient/src/adapters/auth/hybrid-google-login.strategy.ts                   [NEW: extracted class, exported, so vitest can import + mock]
apps/webClient/src/presentation/components/social-buttons-login.tsx:32-35           [EDIT: onError detects error?.isAccountReauth === true and sets modal state; otherwise falls back to errorToast]
apps/webClient/src/presentation/components/social-buttons-login.tsx:60-89           [EDIT: render the GoogleAccountReauthModal conditionally on state]
apps/webClient/src/presentation/components/auth/GoogleAccountReauthModal.tsx       [NEW: portal-based overlay reusing Card/Button i18n keys, no shadcn dep]
apps/webClient/src/infrastructure/i18n/locales/en.json                              [EDIT: add auth.accountReauth.{title,body,step1,step2,step3,step4,step5,ctaGuide,ctaRetry} keys]
apps/webClient/src/infrastructure/i18n/locales/es.json                              [EDIT: same keys in Spanish]
apps/webClient/src/adapters/auth/__tests__/native-google-login.strategy.spec.ts     [EDIT: branches 1+2 assert (err as any).isAccountReauth === true; branches 3+4 assert it is undefined]
apps/webClient/src/adapters/auth/__tests__/hybrid-google-login.strategy.spec.ts     [NEW: 5-branch vitest spec — positive (rethrow on isAccountReauth) + 3 substrings (fallback) + negative (rethrow generic)]
apps/webClient/tests/google-account-reauth-no-fallback.spec.ts                     [NEW: Playwright e2e that mocks @capgo/capacitor-social-login throw, asserts NO page.goto external, asserts modal visible]
```

### Knowledge base

```
knowledge.md:6.8.3-6.8.4                                                                [EDIT: append §6.8.4 invariant "the marker contract for nativegoogle: producers"]
rpi/mobile-google-login-regression/research.md                                            [NEW: this artifact]
rpi/mobile-google-login-regression/plan.md                                               [NEW: companion plan.md]
docs/changelog.md:5                                                                       [EDIT: prepend v1.7.x entry for regressión fix; minor bump]
package.json:5 (root)                                                                      [EDIT: bump version]
```

### NOT touched (verified out-of-scope)

- `apps/api/src/application/auth/auth.service.ts` — backend OAuth path is already correct (returns `{ accessToken, refreshToken, user, message }` since v1.3.0). The regression is purely frontend; backend log lines and `eagerCreateUserSettingsRow` are unaffected.
- `apps/mobile/capacitor.config.ts` — `SocialLogin.providers.google=true` is correct and matches the v1.6.0 build. Don't change it.
- `apps/mobile/android/app/src/main/AndroidManifest.xml` — the absence of OAuth deep-link intent-filter is the reason `signInWithRedirect` never returned inside the WebView, BUT adding an intent-filter is its own RPI (would also touch Firebase + Google Cloud config). Out of scope.
- `apps/webClient/src/infrastructure/native.ts` and `apps/webClient/src/infrastructure/platform.ts` — `isNativePlatform()` is correct; the bypass here is at the Strategy level, not Detection.
- `apps/webClient/src/presentation/components/social-buttons-login.tsx` import site `@presentation/utils/toast` — currently imports `errorToast, successToast from "@presentation/utils/toast"`, and the file does exist at `apps/webClient/src/presentation/utils/toast.tsx`. No change needed; the toast path stays as the fallback for non-reauth errors.

## Code Examples

### A. The coupling that produces the bug

```ts
// apps/webClient/src/adapters/auth/index.ts:81-95
try {
  const native = new NativeGoogleLoginStrategy();
  return await native.login();
} catch (error) {
  const msg = error instanceof Error ? error.message.toLowerCase() : "";
  if (
    msg.includes("not implemented") ||
    msg.includes("no credentials available") ||
    msg.includes("nativegoogle")
  ) {
    console.warn("Native Google plugin unavailable — falling back to Web SDK redirect.", error);
    const web = new WebGoogleLoginStrategy();
    return await web.login();
  }
  // Anything else (user cancelled, network) — surface to the UI.
  throw error;
}
```

Three callers of `nativegoogle:` exist in HEAD: `WebGoogleLoginStrategy:71` ("nativegoogle: signInWithRedirect failed:"), `NativeGoogleLoginStrategy:128` ("nativegoogle: SocialLogin.initialize failed:"), and now `buildAccountReauthRethrow:96` ("nativegoogle: Account reauth failed [code=16]..."). All three routes through `HybridGoogleLoginStrategy`'s catch → Web SDK → browser.

### B. The matcher that fires the producer

```ts
// apps/webClient/src/adapters/auth/native-google-login.strategy.ts:28-30
function isAccountReauthError(error: unknown): boolean {
  if (extractErrorCode(error) === 16) return true;
  const message = extractErrorMessage(error).toLowerCase();
  return message.includes("account") && message.includes("reauth");    // ⚠ loose text-fingerprint
}
```

The text-fingerprint `(account AND reauth)` triggers on any error whose message contains BOTH substrings — including transient Firebase `FirebaseError(code: '…', message: '…')` thrown by `signInWithCredential` if the JWT exchange fails post-plugin with a wrapped error. Less clearly, but possible.

### C. The desired contract — typed property + preserved prefix

```ts
// desired native-google-login.strategy.ts:75-100
function buildAccountReauthRethrow(originalError: unknown): Error {
  const originalCause = extractErrorMessage(originalError);
  const err = new Error(
    `nativegoogle: Account reauth failed [code=16]. ` +
      `See apps/mobile/README.md → 'Account reauth failed' for the ` +
      `5-step SHA-1 registration playbook. (original-cause: ${originalCause})`,
  );
  // ES2022 Error cause — preserved for Sentry / log aggregators.
  (err as Error & { cause?: unknown }).cause = originalError;

  // ───────────────────────────────────────────────────────────────────────
  // v1.7.3 NEW CONTRACT.
  //
  // The `nativegoogle:` text prefix is kept verbatim for back-compat
  // with log-greppers and Sentry breadcrumbs. On TOP of it, the error
  // carries a typed sentinel that HybridGoogleLoginStrategy reads
  // BEFORE the substring ladder — see apps/webClient/src/adapters/auth/
  // hybrid-google-login.strategy.ts `login()`.
  //
  // This decouples the "Account reauth" producer from the Web SDK
  // fallback ladder (which would otherwise re-route to signInWithRedirect
  // and open the phone browser). The SHA-1 misregistration is NOT
  // recoverable by Web SDK in any way — falling back to it just opens
  // a browser that the WebView can never return from (no Android
  // intent-filter for /auth/callback). So the right surface is an
  // actionable Toast/Modal explaining the 5-step playbook, NOT the
  // Web SDK.
  //
  // Do NOT collapse (err as ...).isAccountReauth into a generic
  // boolean — the typed sentinel must remain a stable contract for
  // knowledge.md §6.8.4 (lint hook) to flag any future producer that
  // forgets to set it. See plan.md T1.1.
  // ───────────────────────────────────────────────────────────────────────
  (err as Error & { isAccountReauth?: boolean }).isAccountReauth = true;
  return err;
}
```

### D. The desired Hybrid pre-check

```ts
// desired apps/webClient/src/adapters/auth/hybrid-google-login.strategy.ts
import { isNativePlatform } from "@infrastructure/platform";
import type { GoogleLoginStrategy } from "./google-login-strategy";
import { NativeGoogleLoginStrategy } from "./native-google-login.strategy";
import { WebGoogleLoginStrategy } from "./web-google-login.strategy";

/**
 * Augmented Error contract: any Error carrying
 * `isAccountReauth === true` is a SHA-1 misregistration or other
 * non-recoverable signal from the native plugin and MUST NOT be
 * routed to the Web SDK fallback. Producer: native-google-login.
 * strategy.ts → buildAccountReauthRethrow. Sentinel owner: see
 * knowledge.md §6.8.4.
 */
type AccountReauthError = Error & { isAccountReauth: true };

function isAccountReauthError(err: unknown): err is AccountReauthError {
  return err instanceof Error && (err as { isAccountReauth?: boolean }).isAccountReauth === true;
}

export class HybridGoogleLoginStrategy implements GoogleLoginStrategy {
  async login(): Promise<{ idToken: string }> {
    if (isNativePlatform()) {
      try {
        const native = new NativeGoogleLoginStrategy();
        return await native.login();
      } catch (error) {
        // ──── §6.8.4 invariant: typed sentinel MUST be checked first ────
        if (isAccountReauthError(error)) {
          // SHA-1 misregistration (or text-fingerprint match) — surface to
          // the UI with a Modal. DO NOT fall back to Web SDK, because
          // signInWithRedirect opens the phone browser and the WebView
          // cannot return to the app (no OAuth deep-link intent-filter on
          // AndroidManifest). See apps/mobile/README.md → 'Account reauth'.
          console.warn(
            "nativegoogle: Account reauth rethrow detected — surfacing to UI (no fallback).",
            error,
          );
          throw error;
        }
        // Pre-existing substring ladder — kept untouched for other nativegoogle:
        // producers (init failures, missing env var) that DO benefit from
        // the Web SDK fallback. Producers and consumers are listed under
        // knowledge.md §6.8.4.
        const msg = error instanceof Error ? error.message.toLowerCase() : "";
        if (
          msg.includes("not implemented") ||
          msg.includes("no credentials available") ||
          msg.includes("nativegoogle")
        ) {
          console.warn(
            "Native Google plugin unavailable — falling back to Web SDK redirect.",
            error,
          );
          const web = new WebGoogleLoginStrategy();
          return await web.login();
        }
        throw error;
      }
    }
    const web = new WebGoogleLoginStrategy();
    return await web.login();
  }
}
```

### E. The desired UI surface — Modal, not Toast

```tsx
// desired apps/webClient/src/presentation/components/auth/GoogleAccountReauthModal.tsx
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

interface GoogleAccountReauthModalProps {
  error: Error & { isAccountReauth: true };
  onClose: () => void;
  onRetry: () => void;
}

export function GoogleAccountReauthModal({
  error,
  onClose,
  onRetry,
}: GoogleAccountReauthModalProps) {
  const { t } = useTranslation();
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      data-testid="google-account-reauth-modal"
    >
      <Card className="w-full max-w-lg p-6 bg-card text-neutral">
        <h2 className="text-lg font-semibold mb-2">
          {t("auth.accountReauth.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("auth.accountReauth.body")}
        </p>
        <ol className="text-sm space-y-2 list-decimal list-inside mb-6">
          <li>{t("auth.accountReauth.step1")}</li>
          <li>{t("auth.accountReauth.step2")}</li>
          <li>{t("auth.accountReauth.step3")}</li>
          <li>{t("auth.accountReauth.step4")}</li>
          <li>{t("auth.accountReauth.step5")}</li>
        </ol>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>
            {t("auth.accountReauth.ctaClose")}
          </Button>
          <Button variant="secondary" onClick={onRetry}>
            {t("auth.accountReauth.ctaRetry")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

The Modal renders ANCHORED on the Reauth error — NOT a `react-hot-toast`. Reason: auth-blocking errors that prevent login completion deserve a sticky, dismissable surface; toasts disappear in 5 s (see `apps/webClient/src/infrastructure/toast.config.tsx:16` `duration: 5000`) which is too short for a 5-step playbook read. The Modal also escapes the WebView's viewport, so a Capacitor slim-screen keyboard popping up does not push the explanation off-screen.

#### §E.a — Accessibility & dismissal paths (added in code-review round 3)

The Modal exposes three equally-respected dismissal paths so no user is locked out from a recovery action:

1. **Close button** (`data-testid="google-account-reauth-close"`) — primary visual affordance for sighted users; calls `onClose()`, parent clears `reauthError` state.
2. **Retry button** (`data-testid="google-account-reauth-retry"`) — primary CA (Call To Action) for the recovery action; calls `onRetry()`, parent clears state AND re-invokes `handleLoginWithGoogle()`.
3. **Escape keypress** — the document-level `keydown` handler bound inside a `useEffect` calls `onClose()` on `e.key === "Escape"`. Cleanup function `removeEventListener`s on unmount so a global handler does not leak across parent re-renders.

Why all three: the WAI-ARIA dialog pattern requires both a Close affordance AND a keyboard-quit affordance (`aria-modal="true"` alone is not sufficient per ARIA APG dialog guidance). Mobile/Capacitor users on a WebView sometimes lack a hardware Escape key but get a software one via the Android navigation bar `Esc` accessibility shortcut; Expo AppsSurface-class screens share the same handler. Adding Escape in the code-review round closes the WAI gap without introducing a `@radix-ui/react-dialog` dependency.

Focus management: Retry CTA (`retryButtonRef.current?.focus()` on open) auto-focuses so a Tab-key-only user lands on the recovery action, not on Close. The Close button retains tab order but is not the auto-focus target.

#### §E.b — Plan/code drift invariant

The §T2.1 acceptance criteria in `rpi/mobile-google-login-regression/plan.md` MUST enumerate all three dismissal paths; if a future refactor drops any of them, the discrepancy must be filed as a §6.8.4 lint-hook TODO amend before merge. The `Escape` path in particular is non-obvious from a JSX read — only the `useEffect` body reveals it — so the plan-level documentation is the single source of truth that future readers consult.

## FAR Scale Output

| Dimension | Score | Justification |
|---|---|---|
| **Factual** | 5 | Every cited file:line was read from the live repo this session (`apps/webClient/src/adapters/auth/native-google-login.strategy.ts`, `web-google-login.strategy.ts`, `index.ts`, the matcher spec, `social-buttons-login.tsx`). The fallback-ladder behavior at index.ts:81-95 is reproduced verbatim. The matcher's loose `account+reauth` text-fingerprint is reproduced from line 28-30. The AndroidManifest.xml absence claim references the file content read earlier (only the MAIN+LAUNCHER intent-filter, no `<data android:scheme="https" android:host="..."/>` for OAuth redirect). |
| **Actionable** | 4 | The fix is bounded: ~80 lines split across two files in `apps/webClient/src/adapters/auth/`, plus a Modal in `apps/webClient/src/presentation/components/auth/`. Two soft gaps: (a) the Canonical-design choice between `boolean property` vs `AccountReauthError class` is defended; the boolean is kept because the error crosses an axios/React-Query serializer boundary that drops `instanceof` checks (this is the meridian design choice worth a reader follow-up), (b) the React-tree where the Modal is mounted (`SocialLoginButtons` exclusively, vs globally via the `<App/>` portal) is a downstream Plan decision. Plan T2.3 / T2.5 will pin both. |
| **Relevant** | 5 | Direct fix to the user's production-blocking symptom (browser opens instead of completing auth, on Android). Codifies §6.8.4 so future features cannot re-introduce the same coupling. |
| **Mean** | **4.67** | **PASS** (≥ 4.00) |

```
F: 5  A: 4  R: 5  Mean: 4.67  --> PASS
```

## Testing Strategy

### Unit (vitest)

- **`apps/webClient/src/adapters/auth/__tests__/native-google-login.strategy.spec.ts`** — extend the existing 4 branches. Branches 1+2 (positive) MUST additionally assert `error.isAccountReauth === true` (typed sentinel contract). Branches 3+4 (negative) MUST assert it is `undefined`. This locks the producer end of §6.8.4.

- **`apps/webClient/src/adapters/auth/__tests__/hybrid-google-login.strategy.spec.ts`** [NEW] — five test branches covering the dispatcher:
  1. Native throws with `isAccountReauth: true` → Hybrid rethrows. Web SDK is **NOT** instantiated.
  2. Native throws a generic Error whose message contains `not implemented` → Hybrid falls back to Web SDK.
  3. Native throws a generic Error whose message contains `no credentials available` → Hybrid falls back to Web SDK.
  4. Native throws a generic Error whose message contains `nativegoogle:` (the init-failure producer at line 128) → Hybrid falls back to Web SDK. **This is the load-bearing test**: it asserts the substring ladder remains active for the legitimate fallback cases.
  5. Native throws a generic `TypeError(message: 'Cannot read properties of undefined')` (no substring match) → Hybrid rethrows without fallback. Pin pre-existing behavior.

  All five tests use `vi.spyOn` on both `NativeGoogleLoginStrategy.prototype.login` and `WebGoogleLoginStrategy.prototype.login` to assert which one was called.

### E2E (Playwright)

- **`apps/webClient/tests/google-account-reauth-no-fallback.spec.ts`** [NEW] — end-to-end guarantee that the regression does NOT recur:
  1. Intercept the `VITE_GOOGLE_WEB_CLIENT_ID` env + mock `@capgo/capacitor-social-login`'s `SocialLogin.login` (via `page.addInitScript` overriding the global `Capacitor` plugins) to reject with `code: 16` and message `"Google Sign-In failed: [16] Account reauth failed."`.
  2. Stub `isNativePlatform()` to return `true` so the Strategy chooser picks Native.
  3. Stub the backend POST `/auth/firebase-login` to either accept or reject (test does not depend on backend response — the auth-surface is what matters).
  4. Tap the Google Login button.
  5. **Assert**: `page.waitForSelector('[data-testid="google-account-reauth-modal"]')` resolves with the Modal visible.
  6. **Assert**: `page.url()` never leaves the WebView origin (`expect`). The negative space — "no `page.goto` to `https://accounts.google.com/...`" — is the regression's signature; if absent, this guard passes.
  7. Capture a screenshot and attach to the failure message so the operator-debugger sees the visible result.
  8. Locale: two passes, one with `Accept-Language: en`, one with `Accept-Language: es`, asserting the localized strings render in each.

### Manual device smoke (operator-deliverable)

- Reproduce the v1.6 behavior on a real device with a freshly-installed APK, then verify the v1.7.3 build:
  - Tap Google Login from the login page.
  - Pick an account from the Credential Manager bottom sheet.
  - **Expected**: the WebView shows the new Modal (in the user's locale) explaining the 5 steps. No system browser ever opens. The Modal has three dismissal paths — Close, Retry (re-invokes the login flow), OR Escape keypress — all of which clear the parent `reauthError` state without leaving the WebView. Verify each dismissal path explicitly during the smoke pass:
    - **Close**: tap the Close button → Modal disappears, focus returns to the Google login button → `data-testid="google-account-reauth-close"`.
    - **Retry**: tap the Retry button → Modal disappears and the plugin flow re-runs (account picker appears again IF the SHA-1 has been re-registered in Firebase; the loop is idempotent and self-terminating on success) → `data-testid="google-account-reauth-retry"`.
    - **Escape**: press the hardware/software Escape key → Modal disappears via `onClose()`; the `keydown` listener is removed on unmount so a subsequent login attempt does NOT inherit a stale handler → i.e. no `nativegoogle:` console.warn spam on the second try.
  - **Regression** (must NOT happen): Chrome Custom Tab opens, hangs, user backs out lost.
- Verify the Capacitor dev-server / Vite hot-reload still works end-to-end (`pnpm --filter mobile dev:android`).

### Observability

- Backend already logs `🔓 Login con Firebase exitoso para: …` on `/auth/firebase-login` success and `🚨 Falló el login con Firebase: …` on failure. Frontend console.warn adds `nativegoogle: Account reauth rethrow detected — surfacing to UI (no fallback).` after §6.8.4 is enforced. A grep on `apps/api/src/infrastructure/log/logger.service.ts`-bound logs surfaces the Sentry toast: `'Account reauth [code=16]'` in lowercase formed with both substrings.
- Optional follow-up RPI: a Sentry breadcrumb helper that ingests the `error.isAccountReauth: true` sentinel as a structured tag — flagged as TODOs.

## Potential Plan Pattern Recommendations

1. **Adapter-narrowed typed sentinel** — Pattern: the producer-side function attaches a typed boolean to the error; the dispatcher (Hybrid) reads it via a small `isAccountReauthError(error): error is AccountReauthError` predicate. Mirrors the §6.8.3 `!== true` strict-positive invariant in spirit: a typed property check cannot false-positive on raw-string substring search.
2. **Surface-tier escalation** — Pattern: when a producer marks an error as **non-recoverable**, it must re-define the surface independently of the fallback ladder (Modal here, not Toast). Codified as "if `isAccountReauth`, surface to Modal; else surface to Toast + fallback if applicable". Mirrors the visual-hierarchy rule that **auth-blocking errors deserve a sticky surface** (Modals survive toast-dismiss events).
3. **Portal-based overlay w/o shadcn dep** — Pattern: `createPortal(modalNode, document.body)` reuses existing UI primitives (Card, Button) — avoids introducing `@radix-ui/react-dialog` to a stack that does not yet pull Radix. Cost: ~60 LOC of the Overlay component.
4. **Defensive class-extraction for testability** — Pattern: extract `HybridGoogleLoginStrategy` from module-local (`apps/webClient/src/adapters/auth/index.ts:66`) into `hybrid-google-login.strategy.ts` so vitest can `import` it and stub methods via `vi.spyOn`. The current "module-local class" makes unit-testing impossible without re-implementing the dispatcher.
5. **Document the contract in `knowledge.md §6.8.4`** — Pattern (mirrored from §6.8.1 / §6.8.2 / §6.8.3): codify invariants (typed property + order of checks) so the next feature that adds a producer must keep the contract. Lint-hook TODO is explicit so future CI work can target it. This is a structural defense — not a runtime one — and is the cheapest way to make the bug unrepeatable.

## Assumptions

1. ✅ `react-hot-toast` does NOT lose own properties of the `Error` instance during render. (Verified via its source: `react-hot-toast` only reads `error.message`, then displays). So `(err as Error & { isAccountReauth?: true }).isAccountReauth` survives the journey from `HybridGoogleLoginStrategy.login()` → `useMutation.onError(error)` → `errorToast(error.message)` consumer. Confirmed by reading `apps/webClient/src/presentation/utils/toast.tsx` and `apps/webClient/src/presentation/components/social-buttons-login.tsx:32-35` — the consumer side reads `error.message`, which never strips properties.
2. ✅ `isNativePlatform()` is accurate on the APK WebView (3-tier detection in `apps/webClient/src/infrastructure/native.ts:37-100`); the strategy selector picks Native first.
3. ⚠ The matcher `isAccountReauthError` is still the defensive net (text-fingerprint) for plugin versions that do not surface a numeric code. We do **NOT** narrow it to numeric-only in this RPI; doing so would orphan plugin variants that emit only a wrapped string. Branch 2 of the existing spec is load-bearing.
4. ⚠ The Modal renders **only** when the underlying error object is reconstructable by the consumer (`useMutation`'s `error` param retains the properties). Verified via React Query 5 source: it doesn't strip own properties.
5. ✅ The two i18n locales (en.json, es.json) are structurally equivalent and the new keys can be added to both atomically.
6. ⚠ `package.json` version bump will go from `1.7.0` → `1.7.1` (patch). Reason: the change fixes a regression (browser opens on Android) without adding new features. The matcher itself is unchanged, only its contract surface and dispatcher guard change. Per `knowledge.md §16.1`: "Bug fix / small tweak → Patch".
7. ⚠ iOS is out of scope. The Capacitor plugin works on iOS too but the regression is Android-specific (Android System WebView's third-party cookie policy is the underlying constraint, but the surface-level symptom is across both platforms). The Modal is shown on iOS too as a free win.
8. ✅ Behavior of all OTHER `nativegoogle:` producers — `web-google-login.strategy.ts:71` ("nativegoogle: signInWithRedirect failed:") and `native-google-login.strategy.ts:128` ("nativegoogle: SocialLogin.initialize failed:") — is preserved verbatim by NOT touching the substring ladder. Only isAccountReauth-tagged errors DETOUR to the Modal path.

## Out of Scope

- **iOS-specific testing** — iOS WebView behavior is not in this user's symptom; an iOS smoke pass is a follow-up.
- **Adding OAuth deep-link intent-filter to `AndroidManifest.xml`** — would let `signInWithRedirect` return to the app. This is its own RPI ("add OAuth deep-link to Capacitor Android shell"), enterprise-impacting (AndroidManifest + Firebase + Google Cloud config), and unconcerned with the user's symptom today (the symptom IS the broker redirect returning nothing; a deep-link only helps if the Web SDK fallback is still the desired path).
- **Replacing `react-hot-toast` with a different toaster** — works fine; the Modal is a *separate*, more prominent surface, not a Toast-replacement.
- **Replacing the matcher** — `isAccountReauthError` is the right net for plugin variants; only the contract surface needs repair.
- **Removing `apps/mobile/README.md` direct references** — the modal links INTO `apps/mobile/README.md → 'Account reauth failed'` (existing 5-step playbook) for the canonical guide. The Modal is a quick-summary; the README is the long-form.

## Cross-Document Links

- `rpi/mobile-google-login-regression/research.md` (this file) → `rpi/mobile-google-login-regression/plan.md`
- `docs/rpi/Research.md` (framework) → `Knowledge entry — append a §6.8.4 invariant under "Redux Selector + Router Guard Pitfalls"`.
