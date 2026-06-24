import {
  loginAction,
  setAuthReady,
  setUser,
} from "@adapters/slices/auth/authSlice";
import api from "@infrastructure/api.config";
import { RoutePaths } from "@presentation/utils/routes";
import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { useLocation } from "react-router";

/**
 * Restores the user session on app cold start / route change.
 *
 * Responsibilities:
 *  1. Hit `/auth/verify` to check whether the browser still carries a valid
 *     refresh cookie. Returning users on a freshly installed mobile APK
 *     rely on this — the splash waits for `authReady` (see splash.tsx)
 *     before deciding whether to bounce them to the dashboard or the login
 *     page.
 *  2. If verify returns 200, also pull `/user/profile` and dispatch
 *     `loginAction` + `setUser` so the auth slice's `isAuthenticated`
 *     matches reality. The historical version only dispatched `setUser`,
 *     which left `isAuthenticated: false` after a successful verify — that
 *     caused the splash to send authenticated users to the login page.
 *  3. Dispatch `setAuthReady` in a `finally` so the splash stops waiting
 *     regardless of whether verify succeeds, fails, or throws.
 *
 * Public-route policy: explicit reset-password / forgot-password routes
 * stay skipped because the user is mid-flow and verifying at those moments
 * could race with the reset submit. The landing routes (`/`,
 * `/how-it-works`, etc.) now DO run verify so the splash on the root path
 * has the auth slice settled by the time the splash animation finishes.
 */
const useRestoreSession = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialVerifyDone = useRef(false);
  const lastVerifyCallRef = useRef(0);

  // Routes where /auth/verify must NOT run. We deliberately keep `/` OUT of
  // this list — the native splash needs the auth slice settled on cold start,
  // and waiting for the user to navigate elsewhere would defeat the purpose.
  // Reset/forgot-password pages stay skipped because verifying at that
  // moment could race with the reset-token submission.
  const SKIP_VERIFY_ROUTES = [
    `${RoutePaths.Auth}/${RoutePaths.ForgotPassword}`,
    `${RoutePaths.Auth}/${RoutePaths.ForgotPasswordConfirmation}`,
    `${RoutePaths.Auth}/${RoutePaths.ResetPassword}`,
  ];
  const shouldSkipVerify = SKIP_VERIFY_ROUTES.includes(location.pathname);

  useEffect(() => {
    // 2. Intervalo de verificación (5 minutos)
    const CHECK_INTERVAL = 5 * 60 * 1000;

    const verifySession = async () => {
      // Throttle: saltar si la última llamada fue hace menos de 30 segundos
      const THROTTLE_MS = 30 * 1000;
      const now = Date.now();
      if (now - lastVerifyCallRef.current < THROTTLE_MS && lastVerifyCallRef.current !== 0) {
        return;
      }
      lastVerifyCallRef.current = now;

      try {
        const response = await api.get("/auth/verify");

        if (response.status === 200) {
          const userProfile = await api.get("/user/profile");
          const profile = userProfile?.data;
          if (profile) {
            dispatch(setUser(profile));
            // Verify succeeded → the refresh cookie is valid → the user is
            // already authenticated server-side. Flip the slice so the splash
            // sends them to /app/dashboard instead of /auth/login.
            dispatch(loginAction());
          }
        }
      } catch (error) {
        // 401, network drop, or backend outage. The axios interceptor
        // already routed 401s to the refresh flow; an error here just
        // means we couldn't confirm a session, which is fine — the splash
        // will send an unauthenticated user to the login page.
        console.error("🔴 Error validating sesion:", error);
      } finally {
        // Telling the slice that auth state is now known, regardless of
        // outcome. SplashPage is waiting on this; without the dispatch the
        // splash would time out at its 3s fallback instead of routing
        // correctly.
        dispatch(setAuthReady());
      }
    };

    // Skip verification only on reset/forgot-password routes. `/` and the
    // other public routes still run verify on the first mount so SplashPage
    // (rendered at `/` on native) doesn't bounce authenticated users.
    if (shouldSkipVerify) {
      initialVerifyDone.current = false;
      return;
    }

    // Solo verificar inmediatamente en el primer montaje o al volver de ruta
    // que ya forzó un reseteo del flag (reset/forgot-password).
    if (!initialVerifyDone.current) {
      verifySession();
      initialVerifyDone.current = true;
    }

    // Configurar intervalo periódico
    intervalRef.current = setInterval(verifySession, CHECK_INTERVAL);

    // Limpieza
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [dispatch, shouldSkipVerify]);
};

export default useRestoreSession;
