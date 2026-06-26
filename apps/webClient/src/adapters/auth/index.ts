import { isNativePlatform } from "@infrastructure/platform";
import type { GoogleLoginStrategy } from "./google-login-strategy";
import { NativeGoogleLoginStrategy } from "./native-google-login.strategy";
import { WebGoogleLoginStrategy } from "./web-google-login.strategy";

export { isNativePlatform } from "@infrastructure/platform";
export { type GoogleLoginStrategy } from "./google-login-strategy";
export { WebGoogleLoginStrategy } from "./web-google-login.strategy";
export { NativeGoogleLoginStrategy } from "./native-google-login.strategy";

/**
 * Hybrid strategy: the single source of truth for picking a
 * Google-login implementation by platform.
 *
 *   ┌────────────────────────────┬──────────────────────────────────────┐
 *   │ isNativePlatform() === true│ NativeGoogleLoginStrategy → @capacitor│
 *   │                            │  -firebase/authentication (Android SDK)│
 *   │                            │  Falls back to WebGoogleLoginStrategy │
 *   │                            │  (signInWithRedirect) when the plugin │
 *   │                            │  is unknown / throws a recognised     │
 *   │                            │  marker (see "Fallback ladder" below).│
 *   ├────────────────────────────┼──────────────────────────────────────┤
 *   │ Standard browser tab       │ WebGoogleLoginStrategy →              │
 *   │                            │ signInWithPopup (snappy UX)          │
 *   └────────────────────────────┴──────────────────────────────────────┘
 *
 * Responsibilities are split so each strategy owns ONE concern:
 *   - `NativeGoogleLoginStrategy`  → only @capacitor-firebase/authentication.
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
 *      Without this tag the redirect branch's failure would surface
 *      as an `auth/operation-not-supported-in-this-environment` etc.
 *      error to the React UI and give the user a hard failure with
 *      no recovery path.
 */
class HybridGoogleLoginStrategy implements GoogleLoginStrategy {
  async login(): Promise<{ idToken: string }> {
    // Native APK: prefer the Capacitor plugin; fall back to Web SDK
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
