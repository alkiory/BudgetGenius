import { isNativePlatform } from "@infrastructure/platform";
import type { GoogleLoginStrategy } from "./google-login-strategy";

// IMPORTANT: the @capgo/capacitor-social-login import is INTENTIONALLY
// dynamic, not static. The previous @capacitor-firebase/authentication
// strategy used `await import(...)` for the same reason — vite.config.ts
// externalizes this module on web builds, which leaves a bare specifier
// at runtime that requires a Capacitor runtime module map to resolve.
// On pure web builds (Vercel / Firebase Hosting) there IS no Capacitor
// runtime, so a static `import { SocialLogin } from '...'` would
// throw `Failed to resolve module specifier` at module-evaluation time
// even before isNativePlatform() returns false. TS infers the type
// directly off the await import; no explicit alias needed.

/**
 * Google Login via the @capgo/capacitor-social-login plugin. The plugin
 * hands control to Android's Credential Manager and renders an in-app
 * bottom sheet — no Chrome Custom Tab, no localhost redirect, no app
 * re-launch needed. Replaced the broken `@capacitor-firebase/authentication`
 * flow in v1.2.0 (see docs/changelog.md).
 *
 * Two-phase wiring:
 *
 *   1. `initializeGoogleAuth()` (in `apps/webClient/src/adapters/auth/
 *      index.ts`) calls `SocialLogin.initialize({ google: { webClientId }})`
 *      exactly once at app startup. The promise is memoised at module
 *      scope so React StrictMode double-mounts and concurrent callers
 *      share the same initialization.
 *
 *   2. `login()` here is the actual sign-in attempt. We belt-and-suspenders
 *      re-check initialization at call time — if `login()` ever runs
 *      before `initializeGoogleAuth()` (e.g. because someone wrote
 *      `new NativeGoogleLoginStrategy().login()` from an isolated test
 *      harness), we still hand back a valid idToken instead of an
 *      "uninitialized" error.
 *
 * Reads the Web Client ID from `VITE_GOOGLE_WEB_CLIENT_ID` (NOT the
 * Android Client ID — those two are different OAuth credentials in
 * Google Cloud Console, and using the Android one breaks the
 * `idToken` JWT signature that `/auth/firebase-login` verifies with
 * Firebase Admin).
 */
let initializationPromise: Promise<void> | null = null;

/**
 * Idempotent initialization for the Credential Manager. Exported so
 * `App.tsx` (via `initializeGoogleAuth()` in `./index.ts`) can call it
 * once at app startup; subsequent calls (including from React
 * StrictMode double-mounts) share the same memoised promise.
 *
 * Note: the SocialLogin import is dynamic to keep web builds safe —
 * see the module-level comment at the top of this file.
 *
 * On rejection (`null` `VITE_GOOGLE_WEB_CLIENT_ID`, Android SHA-1
 * mismatch at register-time, etc.) the cached promise is cleared so
 * the next call retries instead of being permanently locked out. The
 * fallback ladder in `index.ts` (sub-marker `nativegoogle:`) still
 * triggers on the rejection so Web SDK popup takes over.
 */
export function ensureSocialLoginInitialized(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = import("@capgo/capacitor-social-login")
      .then(({ SocialLogin }) =>
        SocialLogin.initialize({
          google: {
            // Web Client ID — NOT the Android Client ID.
            webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID,
          },
        }),
      )
      .catch((err) => {
        initializationPromise = null;
        // Tag so HybridGoogleLoginStrategy's substring ladder catches it
        // and swaps to Web SDK popup/redirect instead of throwing a hard
        // error to the React UI. The original prefix scheme (Firebase
        // plugin era) only knew "not implemented" / "no credentials
        // available" lyrics; capgo errors don't carry those markers, so
        // we tag explicitly at the strategy boundary.
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`nativegoogle: SocialLogin.initialize failed: ${reason}`);
      });
  }
  return initializationPromise;
}

export class NativeGoogleLoginStrategy implements GoogleLoginStrategy {
  async login(): Promise<{ idToken: string }> {      // Defensive: never invoke the native bridge from a browser tab.
    // Credential Manager doesn't exist outside Capacitor — calling
    // `SocialLogin.login()` from a browser throws `not implemented`.
    // Throwing earlier gives a cleaner stack trace than letting the
    // plugin throw an opaque native crash. **Not** tagged as a
    // fallback signal because it indicates a wiring bug, not a
    // plugin availability problem — if the strategy is running in a
    // browser, the Web SDK path is already taken at the Hybrid gate
    // and we never reach this code.
    if (!isNativePlatform()) {
      throw new Error(
        "NativeGoogleLoginStrategy was called on a non-native runtime — this is a wiring bug. Use WebGoogleLoginStrategy in the browser.",
      );
    }

    if (!import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID) {
      // Tag with the same prefix as the rest of capgo's fall-through
      // signals so a missing env var at runtime degrades cleanly to
      // the Firebase Web SDK popup instead of surfacing a hard error
      // to the React UI. Common regression cause: a build that ran
      // before the var was added to .env.production, leaving the
      // APK installed with `import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID
      // === undefined`.
      throw new Error(
        "nativegoogle: VITE_GOOGLE_WEB_CLIENT_ID is not set. Set it in apps/webClient/.env.{development,production} before invoking the native Google login.",
      );
    }

    try {
      await ensureSocialLoginInitialized();
      // Dynamic import — see module-level comment for why.
      const { SocialLogin } = await import("@capgo/capacitor-social-login");
      const response = await SocialLogin.login({
        provider: "google",
        options: {
          scopes: ["email", "profile"],
          // Bottom sheet — stays inside the app, no Chrome Custom Tab.
          style: "bottom",
          // `false` so the user can pick a non-default account. Setting
          // `true` on a device with no authorized accounts throws
          // `NoCredentialException`, which surfaces as "no credentials"
          // — confusing because the user DOES have Google accounts.
          filterByAuthorizedAccounts: false,
        },
      });

      // `response.result` is a discriminated union —
      // `GoogleLoginResponseOnline` (carries `idToken`) or
      // `GoogleLoginResponseOffline` (carries `serverAuthCode`).
      // The plugin defaults to `mode: 'online'` at initialize(), so in
      // practice we will see `Online` here. The narrowing is required
      // by the type signature — `result.idToken` does not exist on the
      // `Offline` branch and TypeScript refuses to compile otherwise.
      const { result } = response;
      if (result.responseType !== "online") {
        throw new Error(
          "nativegoogle: Google native sign-in returned serverAuthCode (offline mode) instead of idToken. Configure SocialLogin.initialize({ google: { mode: 'online' } }) explicitly if you want to defend against a future capgo default flip.",
        );
      }
      const idToken = result.idToken;
      if (!idToken) {
        throw new Error(
          "nativegoogle: Native Google sign-in returned no idToken. Verify the Android OAuth Client is registered with the keystore SHA-1 in Google Cloud Console, and google-services.json points at the Firebase project.",
        );
      }
      return { idToken };
    } catch (error) {
      // Preserve the original message; the HybridGoogleLoginStrategy
      // gatekeeper uses the substring 'nativegoogle' to decide whether
      // to fall back to the Web SDK popup/redirect path.
      console.error("Error during native Google login:", error);
      throw error;
    }
  }
}
