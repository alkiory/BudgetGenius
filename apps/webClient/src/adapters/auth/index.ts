import { isNativePlatform } from "@infrastructure/platform";
import type { GoogleLoginStrategy } from "./google-login-strategy";
import { NativeGoogleLoginStrategy } from "./native-google-login.strategy";
import { WebGoogleLoginStrategy } from "./web-google-login.strategy";

export { isNativePlatform } from "@infrastructure/platform";
export { type GoogleLoginStrategy } from "./google-login-strategy";
export { WebGoogleLoginStrategy } from "./web-google-login.strategy";
export { NativeGoogleLoginStrategy } from "./native-google-login.strategy";

/**
 * Hybrid strategy: tries the native Capacitor plugin first, and if the
 * native module is not implemented (plugin not synced, google-services.json
 * missing, SHA fingerprints not configured), falls back to the Web SDK
 * (signInWithRedirect on native, signInWithPopup on browser).
 *
 * This ensures Google login works regardless of the build state:
 * - CI builds with proper cap sync → native plugin works (best UX)
 * - Local builds without cap sync → fallback to Web SDK redirect
 * - Browser → Web SDK popup (snappy)
 */
class HybridGoogleLoginStrategy implements GoogleLoginStrategy {
  async login(): Promise<{ idToken: string }> {
    if (isNativePlatform()) {
      try {
        // Attempt native plugin first (best UX, no browser redirect).
        const native = new NativeGoogleLoginStrategy();
        return await native.login();
      } catch (error) {
        const msg =
          error instanceof Error ? error.message.toLowerCase() : '';
        // If the native plugin isn't available (not synced, missing config),
        // fall back gracefully to the Web SDK redirect flow instead of
        // showing a hard error to the user.
        if (
          msg.includes('not implemented') ||
          msg.includes('no credentials available')
        ) {
          console.warn(
            'Native Google plugin unavailable — falling back to Web SDK redirect.',
            error,
          );
          const web = new WebGoogleLoginStrategy();
          return await web.login();
        }
        // Any other error (e.g. user cancelled, network) — let it propagate.
        throw error;
      }
    }

    // Standard browser: pop-up via signInWithPopup (snappy, modern browsers
    // don't block popups from user-initiated events). On older browsers that
    // do, the user can allow it.
    const web = new WebGoogleLoginStrategy();
    return await web.login();
  }
}

export function createGoogleLoginStrategy(): GoogleLoginStrategy {
  return new HybridGoogleLoginStrategy();
}
