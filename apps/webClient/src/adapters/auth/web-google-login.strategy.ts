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
 * 1. **Capacitor WebView (isNativePlatform === true)** — pop-ups are
 *    blocked by WebView chrome, so we use `signInWithRedirect`. The
 *    page navigates to Google, the user picks an account, Google
 *    returns the OAuth response to `${AUTH_DOMAIN}/__/auth/handler`
 *    (Firebase's standard handler URL). On Android, the
 *    `AndroidManifest.xml` intent filter for
 *    `https://localhost/__/auth/` re-opens the app's WebView with the
 *    response, and `useFirebaseRedirectReturn.ts` consumes
 *    `getRedirectResult(auth)` to extract the idToken.
 *
 *    WebView's `https://localhost` origin is in Firebase's default
 *    authorized-domain list (Firebase always whitelists `localhost`),
 *    so the redirect works without additional console configuration.
 *
 *    We return a never-resolving promise so React Query's
 *    `mutation.onError` is NOT invoked with a network-level
 *    `navigation-aborted` error during the cross-origin redirect.
 *    Resolving the promise would also fire `onSuccess` with no
 *    `idToken`, which would skip the `/auth/firebase-login` POST and
 *    leave the auth slice in an unauthenticated state — that path is
 *    owned exclusively by `useFirebaseRedirectReturn.ts` once the
 *    redirect completes and the WebView is back at `https://localhost`.
 *
 * 2. **Standard browser** — fast `signInWithPopup`.
 *    `signInWithRedirect` would also work, but a pop-up avoids the
 *    full-page navigation cost and keeps the user in the React app.
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
