# mobile-google-login-regression Plan

> Companion to `rpi/mobile-google-login-regression/research.md` (FAR Mean = 4.67 PASS).
> Goal: ship v1.7.1 — a patch that decouples the `isAccountReauth` producer from the Hybrid fallback ladder, surfaces an actionable SHA-1 playbook Modal on the APK, and codifies §6.8.4 in `knowledge.md` so future features cannot re-introduce the same coupling. Three sequential phases, each ending at a compile+test boundary.

## Implementation Overview

Three coordinated changes, one logical fix:

1. **Producer-side typed contract** — `apps/webClient/src/adapters/auth/native-google-login.strategy.ts:75-100` `buildAccountReauthRethrow` now sets `(err as Error & { isAccountReauth?: boolean }).isAccountReauth = true` on top of keeping the existing `nativegoogle:` text prefix. The boolean is the deterministic contract the Hybrid reads; the prefix is kept for log-greppers/Sentry breadcrumbs.

2. **Dispatcher pre-check** — `apps/webClient/src/adapters/auth/index.ts` extracts `HybridGoogleLoginStrategy` into its own file `apps/webClient/src/adapters/auth/hybrid-google-login.strategy.ts` (so unit tests can import + `vi.spyOn` it). The new class reads `error.isAccountReauth === true` FIRST; if true, rethrow. The pre-existing substring ladder (`not implemented` / `no credentials available` / `nativegoogle`) runs ONLY when isAccountReauth is undefined, preserving the legitimate fallback semantics for init failures and unknown-plugin states.

3. **Sticky UI surface** — `apps/webClient/src/presentation/components/auth/GoogleAccountReauthModal.tsx` [NEW] is a `createPortal`-based overlay reusing existing UI primitives (Card, Button). Wired from `apps/webClient/src/presentation/components/social-buttons-login.tsx:32-35` via a `useState`-driven modal flag. i18n keys land in both `en.json` and `es.json`. When the error is NOT an `isAccountReauth`, the existing `errorToast(error.message)` path is kept verbatim — the fix does not regress generic error UX.

Architectural decisions all locked from Research:

- ✅ Producer side keeps the `nativegoogle:` text prefix (back-compat with log grep + Sentry breadcrumbs).
- ✅ Producer side adds a typed boolean property `isAccountReauth` — survives the axios/React-Query serializer better than `instanceof AccountReauthError` (which would be dropped by `JSON.stringify`/`String()` callers).
- ✅ Hybrid pre-checks the boolean BEFORE the substring ladder. Substring ladder remains intact for other `nativegoogle:` producers (init failures, missing env var, signInWithRedirect failures).
- ✅ Modal surface (`createPortal` + Card), not Toast — auth-blocking errors deserve a sticky surface that survives the 5-s toast-dismiss timer.
- ✅ Testability: extract `HybridGoogleLoginStrategy` from `index.ts:66` (module-local) → `hybrid-google-login.strategy.ts` (exported). Without this extraction, no unit test can import the dispatcher.
- ✅ Knowledge: append §6.8.4 invariant in `knowledge.md`. Cite by line in PR summary.
- ℹ️ Version is patch (1.7.0 → 1.7.1) — bug fix, no new features, no migration. Per `knowledge.md §16.1`.

Quality gates after **every** task: `pnpm --filter frontend-web lint && pnpm --filter frontend-web check-types && pnpm --filter frontend-web test:unit && pnpm --filter frontend-web test && pnpm --filter frontend-web build`. Phase gates add `pnpm --filter mobile sync`.

## Task Breakdown

### Phase 1 — Producer + Dispatcher contract

> Goal: the typed sentinel is set on the rethrown error, and the dispatcher reads it FIRST. The class becomes testable. No UI changes yet.

- [ ] **T1.1** Edit `apps/webClient/src/adapters/auth/native-google-login.strategy.ts:88-100` (`buildAccountReauthRethrow`). After the `(err as Error & { cause?: unknown }).cause = originalError;` line, add `(err as Error & { isAccountReauth?: boolean }).isAccountReauth = true;`. Add a load-bearing comment block citing `knowledge.md §6.8.4` so any future producer here MUST keep the same contract. **No other behavior changes.**
- [ ] **T1.2** Edit `apps/webClient/src/adapters/auth/index.ts`. Extract `class HybridGoogleLoginStrategy implements GoogleLoginStrategy` (currently module-local at lines 66-99) into `apps/webClient/src/adapters/auth/hybrid-google-login.strategy.ts` [NEW]. Re-export from `index.ts` for back-compat. The new class is identical to the old, **plus** a typed-sentinel pre-check (T1.3).
- [ ] **T1.3** Modify `hybrid-google-login.strategy.ts` (the extracted class). In the catch block, **before the substring ladder**, add:

  ```ts
  if (isAccountReauthError(error)) {
    console.warn(
      "nativegoogle: Account reauth rethrow detected — surfacing to UI (no fallback).",
      error,
    );
    throw error;
  }
  ```

  where `isAccountReauthError(err): err is AccountReauthError` lives at module scope and checks `(err as { isAccountReauth?: boolean }).isAccountReauth === true && err instanceof Error`.

- [ ] **T1.4** Update `apps/webClient/src/adapters/auth/index.ts` to re-export `HybridGoogleLoginStrategy` from the new module so existing imports (`createGoogleLoginStrategy`) keep working. (`import { HybridGoogleLoginStrategy } from './hybrid-google-login.strategy';` is unnecessary because we never export the class itself; only `createGoogleLoginStrategy()` matters. So this task may be a no-op.)
- [ ] **T1.5 [P]** Edit `apps/webClient/src/adapters/auth/__tests__/native-google-login.strategy.spec.ts`. To the existing 4 branches (`beforeEach`/`afterEach` stay):
  - Branches 1+2 (positive, code===16 and account+reauth text-fingerprint) — add `await expect(strategy.login()).rejects.toMatchObject({ isAccountReauth: true });`. Pins the producer contract.
  - Branches 3+4 (negative, Firebase network + plain TypeError) — add `await expect(strategy.login()).rejects.not.toMatchObject({ isAccountReauth: true });`. Locks the no-false-positive contract.
- [ ] **T1.6 [P] NEW** `apps/webClient/src/adapters/auth/__tests__/hybrid-google-login.strategy.spec.ts`. Five branches using `vi.spyOn(NativeGoogleLoginStrategy.prototype, 'login')` + `vi.spyOn(WebGoogleLoginStrategy.prototype, 'login')` and `vi.mock('@infrastructure/platform')` returning `isNativePlatform: () => true`. Each test asserts the Web SDK is called or not via `mockImplementation` chain. Use `vi.hoisted` for the mocks (mirrors `native-google-login.strategy.spec.ts`).
  - Branch 1: Native throws `Object.assign(new Error('Account reauth failed'), { isAccountReauth: true })` → Web SDK NOT called, Hybrid rethrows with the same property.
  - Branch 2: Native throws `new Error('not implemented')` → Web SDK IS called.
  - Branch 3: Native throws `new Error('no credentials available')` → Web SDK IS called.
  - Branch 4: Native throws `new Error('nativegoogle: SocialLogin.initialize failed: missing import')` → Web SDK IS called. **Load-bearing test: substring ladder remains active for legitimate fallback cases.**
  - Branch 5: Native throws `new TypeError('Cannot read bar')` → Web SDK NOT called, Hybrid rethrows raw.
- [ ] **Phase 1 gate** — `pnpm --filter frontend-web lint && pnpm --filter frontend-web check-types && pnpm --filter frontend-web test:unit`. Producer end AND dispatcher end are tested in isolation; no UI yet.

### Phase 2 — Modal + UI wiring

> Goal: the Account reauth error lights up a sticky Modal with the SHA-1 5-step playbook. Existing error path stays for non-reauth errors.

- [ ] **T2.1 [NEW]** `apps/webClient/src/presentation/components/auth/GoogleAccountReauthModal.tsx`. Props: `{ error: Error & { isAccountReauth: true }; onClose: () => void; onRetry: () => void; }`. Renders a `createPortal`-based overlay (`react-dom`) anchored on `document.body`. Reuses `Card`, `Button` from `@presentation/components/ui`. `data-testid="google-account-reauth-modal"`, `role="dialog"`, `aria-modal="true"`, `aria-labelledby="google-account-reauth-title"`. Body uses `useTranslation()` with keys `auth.accountReauth.{title,body,step1,…,step5,ctaClose,ctaRetry}`. **Dismissal paths** (three, all wired; see acceptance criteria): Close button primary action, Retry button primary action, **OR Escape keypress** — the document-level `keydown` handler added in the round-3 code review binds `Escape → onClose()` and the Retry CTA receives focus automatically on open so keyboard users land on the recovery action. Implements the design from research.md §C / §E. Extra `data-testid` keys exposed for Playwright assertions: `google-account-reauth-close`, `google-account-reauth-retry`, `google-account-reauth-steps`.

  **T2.1 acceptance criteria** (pins all dismissal paths against §6.8.4 invariants so a future refactor cannot silently drop Escape and regress a11y):
  - Component compiles under `isolatedModules: true` and renders ONLY when `isAccountReauthError(error)` is truthy (defensive narrowing — assertions in vitest cover this).
  - Modal mounts via `createPortal(node, document.body)` so the Card's stacking context cannot clip it.
  - All three dismissal paths clear `reauthError` state in the parent (`SocialLoginButtons`) — Close, Retry (which also re-invokes `handleLoginWithGoogle()`), Escape.
  - Escape listener is registered with `document.addEventListener("keydown", …)` inside a `useEffect` with the cleanup function returning `removeEventListener` so unmounting the Modal does NOT leak a global keydown handler.
  - Retry CTA auto-focuses on open (`retryButtonRef.current?.focus()`); on close, focus returns to the Google button on the parent.
  - i18n keys `auth.accountReauth.{title,body,step1,step2,step3,step4,step5,ctaClose,ctaRetry}` present in BOTH `en.json` AND `es.json` (verified by Phase 2 gate — `pnpm --filter frontend-web tsc --noEmit` plus a JSON validity check).
- [ ] **T2.2** Edit `apps/webClient/src/infrastructure/i18n/locales/en.json` — find the `auth` root object, append:
  ```json
  "accountReauth": {
    "title": "Google sign-in needs the SHA-1 to be registered",
    "body": "Your APK cannot complete Google sign-in because the keystore SHA-1 is not registered in Firebase / Google Cloud. Follow these steps to register it:",
    "step1": "Open Play Console → Setup → App integrity and copy the App signing key SHA-1 (NOT the upload key).",
    "step2": "Firebase Console → Project settings → Android app → add the SHA-1 under 'SHA certificate fingerprints'.",
    "step3": "Re-download google-services.json and place it at apps/mobile/android/app/google-services.json.",
    "step4": "Run pnpm --filter mobile sync and rebuild the APK.",
    "step5": "Settings → Apps → BudgetGenius → Storage → Clear data, then try sign-in again.",
    "ctaClose": "Close",
    "ctaRetry": "Try again"
  }
  ```
- [ ] **T2.3 [P]** Edit `apps/webClient/src/infrastructure/i18n/locales/es.json` — same shape, Spanish copy. (Load-bearing: both locales MUST be present, otherwise the Modal crashes via `i18next` missing-key fallback that still renders in best-effort but stops being useful for the operator debug.)
- [ ] **T2.4** Edit `apps/webClient/src/presentation/components/social-buttons-login.tsx`:
  - Top of file: `import { ErrorBoundary } from "@infrastructure/errorBoundary";` (or just useState), `import { GoogleAccountReauthModal } from "./auth/GoogleAccountReauthModal";`
  - Replace the existing `onError: (error) => { errorToast(error.message); }` with a state-driven version:
    ```tsx
    const [reauthError, setReauthError] = useState<Error | null>(null);
    onError: (error) => {
      if ((error as { isAccountReauth?: boolean })?.isAccountReauth === true) {
        setReauthError(error);
      } else {
        errorToast(error.message);
      }
    }
    ```
  - Below the existing `return ( <div className="flex"> … `, add:
    ```tsx
    {reauthError && (
      <GoogleAccountReauthModal
        error={reauthError as Error & { isAccountReauth: true }}
        onClose={() => setReauthError(null)}
        onRetry={() => { setReauthError(null); handleLoginWithGoogle(); }}
      />
    )}
    ```
  - Wrap the Modal render in `createPortal(<GoogleAccountReauthModal … />, document.body)` so the overlay z-index is above the Card and is dismissable on Capacitor back-button presses (best-effort; back-button keeps login state intact).
- [ ] **Phase 2 gate** — `pnpm --filter frontend-web lint && pnpm --filter frontend-web check-types && pnpm --filter frontend-web build`. The Modal compiles and is wired through i18n + Redux-less state.

### Phase 3 — E2E guard, knowledge, release

> Goal: a Playwright regression spec that catches any future re-introduction of the same coupling. Inventory of invariants codified in `knowledge.md`. Version bumped, changelog updated, no untracked files.

- [ ] **T3.1 [NEW]** `apps/webClient/tests/google-account-reauth-no-fallback.spec.ts`. Playwright spec following the pattern of `tests/auth.spec.ts`:
  - Stub `page.addInitScript(() => { (window as any).Capacitor = { isNativePlatform: () => true, … }; })` so the Strategy chooser picks Native.
  - Use `page.route('**/capacitor-social-login**', …)` to mock the plugin OR mock the resolved `SocialLogin.login` rejection with `{ code: 16, message: "Google Sign-In failed: [16] Account reauth failed." }`. (Likely path: `page.route` against the proxied `http://localhost:5173/**` won't catch the plugin call — it's a native bridge. So the right path is to mock the imported module via Playwright's `addInitScript` overriding a window-loaded shim, OR more cleanly: run the test against a NODE_ENV=test build with vitest-mocked `NativeGoogleLoginStrategy` and a workaround layer.)
  - **Best approach for Playwright without native bridge**: use Playwright's `page.evaluate` to inject a hook that monkey-patches the resolved error from `authRepository.googleLogin` BEFORE the consumer sees it. Skip the plugin mock entirely; mock the repository at the axios layer:
    1. Intercept `POST /auth/firebase-login` with `page.route` returning 200 + valid body.
    2. Intercept the React tree's `googleLogin` mutation by replacing `window.useMutation` patch via `addInitScript` is too invasive.
    3. **Better**: build the test as a vitest with @testing-library/react instead — mount `SocialLoginButtons` with locale=en, error injected via mock, assert Modal renders. Drop the Playwright flag (it isn't an integration test unless we want a full browser, which we don't). Mark this task as "vitest component test instead" for cost reasons.
- [ ] **T3.2 [P]** Edit `knowledge.md:6.8.3` ending block. Append §6.8.4 — invariant for the typed-sentinel producer/consumer contract. Cite the file:line of the producer (`native-google-login.strategy.ts:91`) AND the consumer (`hybrid-google-login.strategy.ts:34`). Mirror the format of §6.8.1 / §6.8.2 / §6.8.3: "The bug class", "The rule", "Defense-in-depth invariants", "Lint hook (TODO)".
- [ ] **T3.3 [P]** Edit `docs/changelog.md:5`. Prepend a `[v1.7.1] — 2026-07-02` entry above the existing v1.7.0 entry:
  ```
  ## [v1.7.1] — 2026-07-02
  
  ### Fixed
  - Google login on the Android APK no longer opens the system browser when the SHA-1 fingerprint is misregistered. A typed `isAccountReauth` sentinel prevents the matcher rethrow from triggering the Web SDK fallback ladder (which previously opened `signInWithRedirect` and stranded users in a hanging Chrome Custom Tab). The new `GoogleAccountReauthModal` shows the 5-step SHA-1 registration playbook in-app. Codified as `knowledge.md §6.8.4`.
  ```
- [ ] **T3.4** Edit root `package.json:5` — bump `"version": "1.7.0"` → `"version": "1.7.1"`. (Per `knowledge.md §16.1`: regression fix is a patch, not a minor.)
- [ ] **T3.5** Run `pnpm --filter frontend-web build` + `pnpm --filter mobile sync` (no native code changed, but the sync regenerates `capacitor.plugins.json` to ensure the APK can be assembled). Smoke-perform on emulator if available.
- [ ] **Phase 3 gate** — `pnpm build` (root) + the device smoke checklist (operator-deliverable). All `pnpm --filter ** test` complete.

## Code References

### New files

```
apps/webClient/src/adapters/auth/hybrid-google-login.strategy.ts                                   [NEW]
apps/webClient/src/presentation/components/auth/GoogleAccountReauthModal.tsx                       [NEW]
apps/webClient/src/adapters/auth/__tests__/hybrid-google-login.strategy.spec.ts                    [NEW]
apps/webClient/tests/google-account-reauth-no-fallback.spec.ts                                    [NEW]
rpi/mobile-google-login-regression/research.md                                                    [NEW — research artifact]
rpi/mobile-google-login-regression/plan.md                                                       [NEW — this artifact]
```

### Files to edit

```
apps/webClient/src/adapters/auth/native-google-login.strategy.ts:88-100                            [T1.1 producer contract]
apps/webClient/src/adapters/auth/index.ts:66-99                                                    [T1.2 class extraction / T1.4 re-export hookup]
apps/webClient/src/adapters/auth/__tests__/native-google-login.strategy.spec.ts:108-141            [T1.5 property assertion extension]

apps/webClient/src/presentation/components/social-buttons-login.tsx:3,32-35,60-89                  [T2.4 Modal wiring + state-driven onError]
apps/webClient/src/infrastructure/i18n/locales/en.json (§ auth)                                    [T2.2 Modal copy]
apps/webClient/src/infrastructure/i18n/locales/es.json (§ auth)                                    [T2.3 Modal copy]

knowledge.md:6.8.3 (endblock)                                                                       [T3.2 §6.8.4 invariant]
docs/changelog.md:5                                                                                 [T3.3 v1.7.1 entry]
package.json:5 (root)                                                                               [T3.4 version bump]
```

## Testing Plan

| Layer | Approach |
|---|---|
| **Unit (vitest, in `apps/webClient/src/adapters/auth/__tests__/hybrid-google-login.strategy.spec.ts`)** | T1.6 — five branches verify the dispatcher's pass-through vs. fallback decision. vi.spyOn on both strategies confirms which one is called. |
| **Unit (vitest, existing `apps/webClient/src/adapters/auth/__tests__/native-google-login.strategy.spec.ts`)** | T1.5 — branches 1+2 assert `isAccountReauth: true` on the rethrow; branches 3+4 assert it is NOT set. Locks the producer end. |
| **E2E (Playwright or vitest + @testing-library/react)** | T3.1 — regression spec simulates `Native throws isAccountReauth error → UI surfaces Modal` AND asserts Web SDK is NOT instantiated (proving no `page.goto` to Google OAuth). Marked `[P]` for parallel execution. |
| **Manual device smoke** | T3.5 — APK on real device. Goal: confirm the Modal opens, the user can dismiss, retry works. Optional gate for release; reproducible from previous mobile-cookies-persistence RPI. |
| **Lint/build gates** | After every task: `pnpm --filter frontend-web lint && pnpm --filter frontend-web check-types`. Phase gates add `pnpm --filter frontend-web build` and `pnpm --filter mobile sync`. |
| **Regression coverage** | Confirm existing `auth.spec.ts`, `home.spec.ts`, `i18n.spec.ts`, `transaction-form.spec.ts`, `currency-conversion.spec.ts`, `offline-queue.spec.ts`, `income-merger.spec.ts`, `onboarding-fresh-user.spec.ts`, `delete-account-confirmation.spec.ts` continue to pass. The auth-flow changes are confined to `SocialLoginButtons.onError` + `HybridGoogleLoginStrategy.login` + `buildAccountReauthRethrow`, so they're isolated. |
| **Cleanup invariant** | After every task: `grep -r "nativegoogle" apps/webClient/src` should ONLY show producers in `native-google-login.strategy.ts` and `web-google-login.strategy.ts`, AND the consumer in `hybrid-google-login.strategy.ts`. No orphan consumers. |

## FACTS Scale Output

| Dimension | Score | Justification |
|---|---|---|
| **Feasibility (F)** | 5 | Strictly bounded: 2 file edits in `apps/webClient/src/adapters/auth/`, 1 Modal in `presentation/components/auth/`, 1 Modal wiring in `social-buttons-login.tsx`, 2 i18n locale edits, 1 spec extension, 1 new spec, 1 knowledge.md append, 1 changelog append, 1 package.json bump. Mirrors the established pattern of `rpi/mobile-cookies-persistence/plan.md` Phase 3 (interceptor + localStorage + cookies shim). No new deps. |
| **Atomicity (A)** | 5 | Each task is single-file (T1.1 ≈ 4 lines; T2.1 a new ~70-line TSX; T3.2 ≈ 60 lines of markdown; T3.1 a new ~120-line spec). No task spans > 2 files. New class extract (T1.2/T1.3) is the cleanest possible unit-test seam. |
| **Clarity (C)** | 4 | Paths and line ranges precise (verified against live file tree). One soft spot: T3.1 may pivot from Playwright to vitest+RTL mid-execution if the native bridge mocking proves intractable; the trade-off is documented in the task description and stays within budget. Changelog wording is canonical. |
| **Testability (T)** | 5 | Spec covers producer contract + dispatcher contract + e2e guard (component-level). Device smoke is operator-deliverable but reproducible. The regression cannot ship without T1.6 green AND T3.1 green. |
| **Size (S)** | 5 | Phases balanced: P1=6, P2=4, P3=5. No task > 1 file edit + 1 spec. |
| **Mean** | **4.80** | **PASS** (≥ 3.00) |

```
F: 5  A: 5  C: 4  T: 5  S: 5  Mean: 4.80  --> PASS
```

## Dependencies & Sequencing

```
Phase 1 ─── Phase 1 gate ───► Phase 2 ─── Phase 2 gate ───► Phase 3 ─── Phase 3 gate (release readiness)
  │                            │                            │
Native + Hybrid typed contract. Modal wired + i18n keys.    e2e + knowledge.md §6.8.4 +
No UI yet.                  Both locales.                   changelog + version bump.
```

Critical-path constraints:

- **T1.1 must land before T1.6** — the dispatcher test relies on the producer's typed contract.
- **T1.2/T1.3 must land before T1.6** — the dispatcher test imports the extracted class.
- **T2.2 + T2.3 must land before T2.1's runtime test** — Modal renders i18n keys; missing keys break the visual regression smoke. Vitest setup with `i18n` already imported (the existing `apps/webClient/src/infrastructure/i18n/LocaleProvider.tsx` makes i18n available).
- **T3.1 must land AFTER T1+T2** — the e2e spec tests both the contract and the surface.
- **T3.4 must land last** — version bump is the canonical "release" marker.

Parallel-execution opportunities (within a phase):

- **T1.1 (producer edit) and T1.5 (extension of existing spec)** are independent (different files). Mark `[P]`.
- **T1.2 (class extract) and T1.3 (pre-check addition) and T1.6 (new spec)** are strongly sequential — T1.6 imports the extracted class.
- **T2.2 (en) and T2.3 (es)** are completely independent. Mark `[P]`.
- **T3.2 (knowledge.md) and T3.3 (changelog) and T3.4 (package.json)** are independent. Mark `[P]`.

External dependencies: **none**. No webhook, payment, third-party service, or native code.

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| The typed boolean property `isAccountReauth` is stripped by `JSON.stringify` somewhere along the path (axios response interceptor / React Query serialization / store dispatch). | Low | UX break: Modal never opens because the property is gone | T1.5's `rejects.toMatchObject` checks the property survives. Manual smoke on the dev-server (T3.5) confirms. If it fails, pivot to `instanceof AccountReauthError` class with global registration. |
| The Modal component re-imports a Tailwind class that doesn't exist (e.g., `bg-black/60` semi-transparent backdrop not supported by the project's Tailwind build). | Low | Visual break on the modal overlay | T3.5 manual smoke confirms. If it fails, fallback to `bg-black` with `opacity-50`. |
| The `createPortal` import isn't tree-shaken by Vite correctly (server-render thow). | Negligible | Builds throw | apps/webClient is pure CSR (Vite SPA), no SSR. Verify via `pnpm --filter frontend-web build`. |
| Strings get out-of-sync between en.json and es.json (one locale has a key the other lacks). | Medium | Some users see empty Modal body | T2.2 + T2.3 are atomic; both landed in Phase 2 gate. Pre-merge: `git diff apps/webClient/src/infrastructure/i18n/locales | grep -E '^\\+' | sort` shows the diff is symmetric. |
| An existing `auth.spec.ts` Playwright test that mocks the login flow also breaks because the new hybrid extraction changes the import surface. | Low | CI red on auth.spec.ts | The class is extracted, not renamed; `createGoogleLoginStrategy()` keeps the same export. Verify in T3.1. |
| The matcher keeping the loose `account+reauth` text-fingerprint still false-positives on Firebase errors where the message transiently contains those words. | Medium | UX break: a transient network error shows the SHA-1 modal | Plan Phase 1 explicitly does NOT narrow the matcher (Research §Assumption 3). Tighten in a follow-up RPI as a §6.8.5 invariant: "matcher must be narrowed to numeric-only IF a follow-up uses a `code` parameter passed by the plugin". |
| A future feature re-introduces `class NativeGoogleLoginStrategy` with a NEW producer that forgets `(err as …).isAccountReauth = true`. | Medium | Regression recurs | T3.2 §6.8.4 invariant pins the contract. Lint hook (TODO). |
| `pnpm --filter mobile sync` regenerates `MainActivity.java` and overwrites our SocialLogin wiring | Low | Mobile Google login regresses | Phase 3 explicitly verifies (`cap sync` is a no-touch sync). |

## Rollback Strategy

| Phase | Rollback Procedure |
|---|---|
| **Phase 1** | `git revert <phase-1-commit>`. The `HybridGoogleLoginStrategy` extraction is revert-and-restore into module-local. The single property line is reverted via the same commit.  **No DB-impacting rollback.** |
| **Phase 2** | `git revert <phase-2-commit>`. Modal removed; `social-buttons-login.tsx#onError` defaults back to `errorToast(error.message)`. The i18n keys can stay (no consumer reads them post-revert), or revert in lockstep. |
| **Phase 3** | `git revert <phase-3-commit>`. knowledge.md §6.8.4 + changelog + package.json revert. No production effect. |

### Recovery dataset

- No DB schema changes. Recovery granularity is per-file.
- Git history is the single source of truth for rollback. No snapshot tables or external artifacts.

### Postmortem trigger conditions

Generate `rpi/mobile-google-login-regression/plan-postmortem.md` if:

- Phase 1 spec fails twice ("Minor") without resolution. Producer-test (T1.5) green but dispatcher-test (T1.6) green independently is a contract violation worth investigating.
- Phase 2 wires Modal but Phase 3 e2e (T3.1) confirms the property is stripped somewhere — pivoting to `AccountReauthError` class.
- Phase 3 device smoke reveals an unforeseen Capacitor / React Tree / i18n interaction that blocks the fix at runtime.

## Reference

- Research artifact: `rpi/mobile-google-login-regression/research.md` (FAR Mean = 4.67, PASS).
- Framework: `docs/rpi/Research.md`, `docs/rpi/Plan.md`, `docs/rpi/Implement.md`.
- Project conventions: `apps/webClient/src/adapters/auth/index.ts` already uses the Strategy Pattern + adapter; the `extract class for testability` move mirrors the existing `index.ts → createGoogleLoginStrategy()` factory pattern.
- Quality gates: `pnpm --filter frontend-web lint && pnpm --filter frontend-web check-types && pnpm --filter frontend-web test:unit && pnpm --filter frontend-web test && pnpm --filter frontend-web build && pnpm --filter mobile sync`.
