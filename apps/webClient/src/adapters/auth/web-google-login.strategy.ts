import { app as firebaseApp } from "@infrastructure/firebaseConfig";
import { isNativePlatform } from "@infrastructure/platform";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import type { GoogleLoginStrategy } from "./google-login-strategy";

/**
 * Google Login via the Firebase JS SDK (web). Pure web SDK
 * implementation — does NOT touch `@capacitor-firebase/authentication`
 * (that lives in `NativeGoogleLoginStrategy`).
 *
 * Two branches:
 *
 * 1. **Capacitor WebView (isNativePlatform === true)** — VESTIGIAL
 *    after the v1.2.0 migration to `@capgo/capacitor-social-login`.
 *    The previous flow called `signInWithRedirect` and relied on an
 *    Android intent filter + `useFirebaseRedirectReturn` hook to
 *    capture the response once Google redirected back. Both were
 *    removed in v1.2.0 because the Capacitor plugin now opens Google's
 *    Credential Manager bottom sheet natively (via
 *    `NativeGoogleLoginStrategy`) and returns the idToken directly,
 *    bypassing the WebView redirect dance entirely.
 *
 *    `signInWithRedirect` is still attempted as a fallback rung
 *    (HybridGoogleLoginStrategy will swap here if the native plugin
 *    is unavailable on a Capacitor build), and the never-resolving
 *    promise below keeps React Query from firing `onError` with a
 *    `navigation-aborted` during the cross-origin navigation. On
 *    modern Android the redirect response will no longer be re-opened
 *    in the WebView (no intent filter), so this branch hangs if
 *    reached — in practice the native plugin succeeds first. If you
 *    ever ship a Capacitor WebView + pure Firebase Web SDK combo
 *    again, you'll need to re-add both the Android intent filter for
 *    `https://localhost/__/auth/` AND a hook that drains
 *    `getRedirectResult` on mount.
 *
 * 2. **Standard browser** — fast `signInWithPopup`.
 *    `signInWithRedirect` would also work, but a pop-up avoids the
 *    full-page navigation cost and keeps the user in the React app
 *    while the user picks their Google account.
 */
export class WebGoogleLoginStrategy implements GoogleLoginStrategy {
  async login(): Promise<{ idToken: string }> {
    if (!firebaseApp) {
      throw new Error(
        "Google login is not available: Firebase is not configured. Please use email and password to sign in.",
      );
    }

    const auth = getAuth(firebaseApp);
    const provider = new GoogleAuthProvider();

    // Branch 1: Capacitor WebView → signInWithRedirect, then block
    // forever. The credential capture happens in
    // `useFirebaseRedirectReturn.ts` once the WebView is back from
    // Google.
    if (isNativePlatform()) {
      try {
        await signInWithRedirect(auth, provider);
      } catch (error) {
        // Tag the error so Hybrid's fallback ladder recognises it as
        // a "give up on the Web SDK too" signal — otherwise a Firebase
        // JS SDK error (e.g. `auth/operation-not-supported-in-this-
        // environment`, `auth/network-request-failed`) would bubble up
        // through the ladder unchanged and land as a hard error in
        // the React UI even though the user might recover with a
        // retry. The ladder falls back to WebGoogleLoginStrategy /
        // signInWithPopup on this marker; if THAT also fails, the
        // resulting error is re-tagged and propagates back through the
        // same ladder pattern (each catch wrapper adds a fresh
        // `nativegoogle:` prefix so the depth is bounded to one).
        const reason =
          error instanceof Error ? error.message : String(error);
        throw new Error(`nativegoogle: signInWithRedirect failed: ${reason}`);
      }

      // Hung promise — survives until the page is either unloaded by
      // the redirect, or the user backs out of the WebView. React
      // Query treats this as "still loading", which is the desired
      // state during the cross-origin navigation.
      await new Promise<never>(() => {
        /* never resolves */
      });
    }

    // Branch 2: standard browser → signInWithPopup.
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    return { idToken };
  }
}
