import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { app as firebaseApp } from "@infrastructure/firebaseConfig";
import { isNativePlatform } from "@infrastructure/platform";
import type { GoogleLoginStrategy } from "./google-login-strategy";

/**
 * Single Google login strategy that works in both regular browsers and the
 * Capacitor WebView.
 *
 * Why not the Capacitor native plugin (`@capacitor-firebase/authentication`)?
 * - That plugin requires a properly configured Android project —
 *   `google-services.json` placed in `apps/mobile/android/app/` AND the
 *   SHA-1/SHA-256 fingerprints registered in the Firebase console. Without
 *   it, `FirebaseAuthentication.signInWithGoogle()` throws
 *   "No Credentials available" because the underlying Firebase SDK has no
 *   GoogleAuthProvider to map the native credential against. The devops
 *   setup is out of scope for this bug fix.
 *
 * Why `signInWithRedirect` instead of `signInWithPopup` on native:
 * - The popup opens a separate window to accounts.google.com from the
 *   WebView's chrome (origin `https://localhost` on Capacitor 4+ with
 *   `androidScheme: 'https'`). The WebView's window manager blocks the
 *   popup and the sign-in flow never resolves.
 * - `signInWithRedirect` keeps the user inside the same WebView session —
 *   the page navigates to Google and back to our origin with the
 *   credential in tow. `https://localhost` is in Firebase Auth's default
 *   authorized-domains set, so the post-redirect callback succeeds.
 *
 * Half-flow note: the first call triggers a full-page navigation, so the
 * promise never resolves in the React-Query sense. The matching
 * "consume the redirect result" half lives in
 * `apps/webClient/src/adapters/hooks/useFirebaseRedirectReturn.ts`, which
 * mounts at app startup, calls `getRedirectResult`, and POSTs the idToken
 * to `/auth/firebase-login`, dispatching `loginAction` + `setUser` if the
 * exchange succeeds.
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

    // 1. Returning from a previous redirect — exchange the pending result
    // for an idToken. Firebase throws `auth/no-redirect-result` if there is
    // nothing to consume; we treat that as "not returning" and fall through
    // to start a new sign-in.
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        const idToken = await result.user.getIdToken();
        return { idToken };
      }
    } catch {
      /* no pending redirect — fall through */
    }

    // 2. Native WebView: popups are blocked, so redirect.
    if (isNativePlatform()) {
      await signInWithRedirect(auth, provider);
      // The page is navigating away to accounts.google.com. Use
      // `useFirebaseRedirectReturn` in App.tsx to consume the result
      // when the redirect lands back in our origin. Returning a never-
      // settling promise instead of throwing keeps any finally-block in
      // the caller from logging the navigation as a hard error.
      await new Promise<never>(() => {});
      // Unreachable — TS needs a return path.
      throw new Error("Google redirect initiated; handling on return trip.");
    }

    // 3. Standard browser: pop-up is the snappier experience.
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    return { idToken };
  }
}
