import { isNativePlatform } from "@infrastructure/platform";
import type { GoogleLoginStrategy } from "./google-login-strategy";
import { NativeGoogleLoginStrategy } from "./native-google-login.strategy";
import { WebGoogleLoginStrategy } from "./web-google-login.strategy";

export { isNativePlatform } from "@infrastructure/platform";
export { type GoogleLoginStrategy } from "./google-login-strategy";
export { WebGoogleLoginStrategy } from "./web-google-login.strategy";
export { NativeGoogleLoginStrategy } from "./native-google-login.strategy";

/**
 * Idempotent Google-plugin initializer. Call once at app startup (we
 * wire it from `App.tsx` alongside `useRestoreSession`) so the
 * Credential Manager UI shows up instantly on the first tap of the
 * Google button — no "please wait while we initialize" delay.
 *
 * Safe to call multiple times: the first call kicks off
 * `SocialLogin.initialize(...)` and stashes the promise at module
 * scope in `native-google-login.strategy.ts`; subsequent calls
 * (including from React StrictMode double-mounts) await the *same*
 * promise instead of re-initializing and re-throwing the underlying
 * GoogleAuthException for credential state.
 *
 * On non-native (web) builds this is a no-op so the dev server
 * doesn't import a Capacitor-only module eagerly.
 */
export async function initializeGoogleAuth(): Promise<void> {
  if (!isNativePlatform()) return;
  const { ensureSocialLoginInitialized } = await import(
    "./native-google-login.strategy"
  );
  await ensureSocialLoginInitialized();
}

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
 *   │                            │ (signInWithRedirect) when the plugin │
 *   │                            │ is unknown / throws a recognised     │
 *   │                            │ marker (see "Fallback ladder" below).│
 *   ├────────────────────────────┼──────────────────────────────────────┤
 *   │ Standard browser tab       │ WebGoogleLoginStrategy →              │
 *   │                            │ signInWithPopup (snappy UX)          │
 *   └────────────────────────────┴──────────────────────────────────────┘
 *
 * Responsibilities are split so each strategy owns ONE concern:
 *   - `NativeGoogleLoginStrategy`  → only @capgo/capacitor-social-login.
 *   - `WebGoogleLoginStrategy`     → only Firebase JS SDK (popup or redirect).
 *   - `HybridGoogleLoginStrategy`  → platform gatekeeper + fallback ladder.
 *
 * Fallback ladder (red errors retagged as `nativegoogle: ...` so the
 * Hybrid can recognise them and swap to the Web SDK redirect):
 *
 *   1. Native plugin throws "not implemented"    → fallback to Web SDK.
 *   2. Native plugin throws "no credentials"     → fallback to Web SDK.
 *   3. Web SDK redirect throws (any message)     → wrapped in
 *      `nativegoogle: signInWithRedirect failed: …` so this ladder
 *      treats it as a non-fatal fallback signal, NOT a hard error.
 */
class HybridGoogleLoginStrategy implements GoogleLoginStrategy {
  async login(): Promise<{ idToken: string }> {
    // Native APK: prefer the Credential Manager; fall back to Web SDK
    // (which will use signInWithRedirect internally).
    if (isNativePlatform()) {
      try {
        const native = new NativeGoogleLoginStrategy();
        return await native.login();
      } catch (error) {
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
        // Anything else (user cancelled, network) — surface to the UI.
        throw error;
      }
    }

    // Standard browser tab: signInWithPopup for snappy UX.
    const web = new WebGoogleLoginStrategy();
    return await web.login();
  }
}

export function createGoogleLoginStrategy(): GoogleLoginStrategy {
  return new HybridGoogleLoginStrategy();
}
