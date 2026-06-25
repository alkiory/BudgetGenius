import {
  loginAction,
  setAuthReady,
  setUser,
} from "@adapters/slices/auth/authSlice";
import { app as firebaseApp } from "@infrastructure/firebaseConfig";
import api from "@infrastructure/api.config";
import { RoutePaths } from "@presentation/utils/routes";
import { getAuth, getRedirectResult } from "firebase/auth";
import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";

/**
 * Reconciles the post-redirect half of the Google sign-in flow.
 *
 * When `signInWithRedirect` is invoked, the page navigates to Google's
 * auth server and returns to our origin with the OAuth response in the
 * URL hash. Firebase Auth keeps that response in pending state and exposes
 * it via `getRedirectResult(auth)`. We consume it once on mount:
 *   1. Get the user's Firebase idToken.
 *   2. POST it to `/auth/firebase-login` → backend verifies with the
 *      Firebase Admin SDK and sets the access/refresh HTTP-only cookies.
 *   3. Fetch `/user/profile` and populate the auth slice.
 *   4. Flip `authReady` so anyone waiting on it (SplashPage,
 *      ProtectedRoute) resolves immediately instead of running another
 *      `/auth/verify`.
 *
 * Belt-and-suspenders: we also stamp `useRef` so the effect runs at most
 * once even under React 19 StrictMode double-mount, where this hook is
 * otherwise invoked twice in dev.
 */
export function useFirebaseRedirectReturn() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || !firebaseApp) {
      return;
    }
    handled.current = true;

    (async () => {
      try {
        const auth = getAuth(firebaseApp);
        const result = await getRedirectResult(auth);
        if (!result?.user) {
          return;
        }

        const idToken = await result.user.getIdToken();
        await api.post("/auth/firebase-login", { idToken });

        try {
          const profile = await api.get("/user/profile", { _retry: true });
          if (profile?.data) {
            dispatch(setUser(profile.data));
          }
        } catch {
          /* profile fetch non-fatal; cookies are already set */
        }

        dispatch(loginAction());
        dispatch(setAuthReady());
        navigate(`${RoutePaths.App}/${RoutePaths.Dashboard}`);
      } catch (error) {
        // `auth/no-redirect-result` is the common case when the user
        // opened a fresh tab without just coming back from Google. We
        // log at info-level so prod telemetry can confirm it is benign.
        // eslint-disable-next-line no-console
        console.info("Google redirect-return resolve skipped:", error);
      }
    })();
  }, [dispatch, navigate]);
}
