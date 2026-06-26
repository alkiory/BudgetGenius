import { isNativePlatform } from "@infrastructure/platform";
import type { GoogleLoginStrategy } from "./google-login-strategy";

/**
 * Google Login via the Capacitor native bridge
 * (`@capacitor-firebase/authentication`). Uses Android's Google Sign-In
 * SDK directly — best UX (no system browser, no round-trip through
 * Google Chrome Custom Tabs), but only works when the Android build has
 * `google-services.json` AND registered SHA-1 / SHA-256 fingerprints in
 * the Firebase project.
 *
 * Dynamic-only imports: this module is dead code in web builds and on
 * any APK that hasn't run `pnpm --filter mobile sync` after the plugin
 * was added. Tree-shaking relies on the `import.meta.env.VITE_CAPACITOR`
 * gate in `vite.config.ts` to keep `@capacitor-firebase/authentication`
 * external on web and bundled on APK.
 *
 * NOTE: this strategy MUST only be invoked on a Capacitor native
 * runtime. The `HybridGoogleLoginStrategy` gatekeeper is the single
 * source of truth for the platform decision; do not call this from
 * browser code paths even if the import appears resolvable.
 */
export class NativeGoogleLoginStrategy implements GoogleLoginStrategy {
  async login(): Promise<{ idToken: string }> {
    if (!isNativePlatform()) {
      // Defensive: never invoke the native bridge from a browser tab.
      // The Capacitor plugin throws a noisy `not implemented` error if
      // it ever runs, but throwing earlier gives a cleaner stack trace
      // and avoids side-effects in the plugin's lazy initialiser.
      throw new Error(
        "NativeGoogleLoginStrategy was called on a non-native runtime — this is a wiring bug. Use WebGoogleLoginStrategy in the browser.",
      );
    }

    try {
      const { FirebaseAuthentication } = await import(
        "@capacitor-firebase/authentication"
      );

      // NOTE: do NOT pass `clientId` here. @capacitor-firebase/authentication v7+
      // reads the OAuth client from `google-services.json` automatically
      // (and TypeScript's SignInWithGoogleOptions type does not accept
      // a `clientId` key — passing one triggers a TS error in the
      // build). For multi-OAuth-client projects the right answer is
      // to make `google-services.json` point at the Android client;
      // we don't ship per-build client overrides.
      const result = await FirebaseAuthentication.signInWithGoogle();

      const idToken = result.credential?.idToken;
      if (!idToken) {
        throw new Error(
          "No ID token received from Google native sign-in — verify google-services.json + SHA fingerprints are wired in the Firebase console.",
        );
      }

      return { idToken };
    } catch (error) {
      // Preserve the original message; wrap so the Hybrid gatekeeper can
      // detect the "no credentials" / "not implemented" failure modes
      // (see apps/webClient/src/adapters/auth/index.ts).
      console.error("Error during native Google login:", error);
      throw error;
    }
  }
}
