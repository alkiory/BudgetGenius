import { isNativePlatform } from "@infrastructure/platform";
import type { GoogleLoginStrategy } from "./google-login-strategy";
import { NativeGoogleLoginStrategy } from "./native-google-login.strategy";
import { WebGoogleLoginStrategy } from "./web-google-login.strategy";

/**
 * Augmented Error contract — see knowledge.md §6.8.4.
 *
 * Any Error carrying `isAccountReauth === true` is a SHA-1
 * misregistration (or transient text-fingerprint match) from the
 * native plugin and MUST NOT be routed to the Web SDK fallback. The
 * one and only producer is
 * `apps/webClient/src/adapters/auth/native-google-login.strategy.ts`
 * → `buildAccountReauthRethrow`. Do not generalize this shape to
 * other error classes without extending §6.8.4 with the new
 * sentinel first.
 */
type AccountReauthError = Error & { isAccountReauth: true };

/**
 * Public surface for the typed sentinel contract — both the type alias
 * and the predicate are EXPORTED so consumers elsewhere (notably
 * `apps/webClient/src/presentation/components/social-buttons-login.tsx`
 * and `GoogleAccountReauthModal.tsx`) share ONE source of truth. Do
 * not re-implement the predicate locally; that creates the §6.8.4
 * drift class the lint hook TODO is designed to catch.
 *
 * Note: under TypeScript `isolatedModules: true` (which the webClient
 * tsconfig enables — see `apps/webClient/tsconfig.app.json`), re-exporting
 * a TYPE without `export type` would throw `TS1205: Re-exporting a type
 * when 'isolatedModules' is enabled requires using 'export type'`. Hence
 * the explicit `export type`.
 *
 * Note 2: the predicate is named `isAccountReauthError` directly (not
 * aliased through `export { _X as Y }`) because `export { X as Y }`
 * creates an EXPORT binding, not a LOCAL binding — so an in-file call
 * to `Y(error)` would `ReferenceError`. We pay the small naming overlap
 * with `apps/webClient/src/adapters/auth/native-google-login.strategy.ts`
 * (which also has a module-local `isAccountReauthError`) because the
 * two have different semantics: native-side numeric code === 16 OR
 * text fingerprint; hybrid-side `isAccountReauth === true` sentinel
 * check. Each lives in its own module so there is no actual conflict.
 */
export type { AccountReauthError };

/**
 * Predicate used by BOTH the dispatcher (this file, line below) and the
 * React surfaces (which import the same exported symbol). Single source
 * of truth for "is this the SHA-1 misregistration I should surface?" —
 * see §6.8.4.
 */
function isAccountReauthError(err: unknown): err is AccountReauthError {
  return (
    err instanceof Error &&
    (err as { isAccountReauth?: boolean }).isAccountReauth === true
  );
}

export { isAccountReauthError };

/**
 * Hybrid strategy: the single source of truth for picking a
 * Google-login implementation by platform.
 *
 *   ┌────────────────────────────┬──────────────────────────────────────┐
 *   │ isNativePlatform() === true│ NativeGoogleLoginStrategy →          │
 *   │                            │ @capgo/capacitor-social-login        │
 *   │                            │ (Android Credential Manager,         │
 *   │                            │ bottom sheet inside the app).        │
 *   │                            │ Falls back to WebGoogleLoginStrategy │
 *   │                            │ when the plugin is unknown / throws  │
 *   │                            │ a recognised substring marker (see   │
 *   │                            │ "Fallback ladder" below).            │
 *   ├────────────────────────────┼──────────────────────────────────────┤
 *   │ Standard browser tab       │ WebGoogleLoginStrategy →              │
 *   │                            │ signInWithPopup (snappy UX)          │
 *   └────────────────────────────┴──────────────────────────────────────┘
 *
 * §6.8.4 invariant — the Order of Checks (load-bearing):
 *   1. **Typed sentinel FIRST** (`isAccountReauth === true`): SHA-1
 *      misregistration surfaces to the UI, NEVER falls back. This
 *      prevents the browser-open regression documented in
 *      `rpi/mobile-google-login-regression/research.md`.
 *   2. Pre-existing substring ladder (init failures, missing env
 *      var, signInWithRedirect failures): Web SDK fallback.
 *   3. Else: rethrow raw, surfacing to UI.
 *
 * Do NOT change the order — merging steps 1+2 (e.g. putting the
 * sentinel inside the substring if-branch) would re-introduce the
 * browser-open regression for any future `nativegoogle:` producer.
 */
export class HybridGoogleLoginStrategy implements GoogleLoginStrategy {
  async login(): Promise<{ idToken: string }> {
    if (isNativePlatform()) {
      try {
        const native = new NativeGoogleLoginStrategy();
        return await native.login();
      } catch (error) {
        // §6.8.4 step 1 — typed sentinel is checked FIRST.
        if (isAccountReauthError(error)) {
          // SHA-1 misregistration (or transient text-fingerprint
          // match). Surface to UI with the actionable modal. DO NOT
          // fall back to Web SDK because signInWithRedirect opens the
          // phone browser and the WebView cannot return to the app
          // (no OAuth deep-link intent-filter on AndroidManifest.xml).
          console.warn(
            "nativegoogle: Account reauth rethrow detected — surfacing to UI (no fallback).",
            error,
          );
          throw error;
        }
        // §6.8.4 step 2 — pre-existing substring ladder for OTHER
        // nativegoogle: producers (init failures, missing env var,
        // signInWithRedirect failures). Producer list:
        //   - apps/webClient/src/adapters/auth/native-google-login.strategy.ts:128
        //     ("nativegoogle: SocialLogin.initialize failed: …")
        //   - apps/webClient/src/adapters/auth/web-google-login.strategy.ts:71
        //     ("nativegoogle: signInWithRedirect failed: …")
        const msg =
          error instanceof Error ? error.message.toLowerCase() : "";
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
        // §6.8.4 step 3 — rethrow raw, surfacing to UI (user
        // cancelled, network, …) via the existing errorToast path.
        throw error;
      }
    }
    // Standard browser tab: signInWithPopup for snappy UX.
    const web = new WebGoogleLoginStrategy();
    return await web.login();
  }
}
