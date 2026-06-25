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

const SKIP_VERIFY_ROUTES = [
  RoutePaths.Home,
  RoutePaths.HowItWorks,
  RoutePaths.PrivacyPolicy,
  RoutePaths.TersmsAndConditions,
  RoutePaths.ContactSales,
  `${RoutePaths.Auth}/${RoutePaths.Login}`,
  `${RoutePaths.Auth}/${RoutePaths.Signup}`,
  `${RoutePaths.Auth}/${RoutePaths.ForgotPassword}`,
  `${RoutePaths.Auth}/${RoutePaths.ForgotPasswordConfirmation}`,
  `${RoutePaths.Auth}/${RoutePaths.ResetPassword}`,
];

/**
 * Maximum time we wait for /auth/verify to settle before we flip
 * `authReady` regardless. Without this a hung TCP connection (the host
 * accepts the SYN but never responds, or the cellular network drops the
 * session silently mid-flight) could leave `authReady=false` for tens of
 * seconds and keep ProtectedRoute parked on its infinite LoadingPage.
 */
const VERIFY_TIMEOUT_MS = 8 * 1000;

const useRestoreSession = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialVerifyDone = useRef(false);
  const lastVerifyCallRef = useRef(0);

  const isPublicRoute = SKIP_VERIFY_ROUTES.includes(location.pathname);

  useEffect(() => {
    if (isPublicRoute) {
      initialVerifyDone.current = false;
      return;
    }

    const CHECK_INTERVAL = 5 * 60 * 1000;
    const THROTTLE_MS = 30 * 1000;

    const verifySession = async () => {
      const now = Date.now();
      if (
        now - lastVerifyCallRef.current < THROTTLE_MS &&
        lastVerifyCallRef.current !== 0
      ) {
        return;
      }
      lastVerifyCallRef.current = now;

      try {
        // Belt-and-suspenders: axios timeout (server is reachable but
        // slow) plus a Promise.race against a hard wall-clock deadline
        // (TCP never responds). Either trigger lets the `finally` block
        // dispatch `setAuthReady`.
        const verifyPromise = api.get("/auth/verify", {
          _retry: true,
          timeout: VERIFY_TIMEOUT_MS,
        });
        // ⚠ DO NOT reference `verifyTimeout` inside its own executor — that
        // creates a Temporal Dead Zone access. The `const` is not initialised
        // until the Promise constructor returns, but the executor runs
        // synchronously inside the constructor. In development this happens to
        // work because V8 defers the ._clear assignment far enough; in
        // production the minifier renames `verifyTimeout` to `O` and the TDZ
        // access throws `ReferenceError: Cannot access 'O' before initialization`.
        let clearVerifyTimeout: (() => void) | undefined;
        const verifyTimeout = new Promise<never>((_, reject) => {
          const t = setTimeout(
            () => reject(new Error("verify-session deadline exceeded")),
            VERIFY_TIMEOUT_MS + 1000,
          );
          clearVerifyTimeout = () => clearTimeout(t);
        });
        const response = await Promise.race([verifyPromise, verifyTimeout]);
        clearVerifyTimeout?.();

        if (response.status === 200) {
          const userProfile = await api.get("/user/profile", {
            _retry: true,
            timeout: VERIFY_TIMEOUT_MS,
          });
          const profile = userProfile?.data;
          if (profile) {
            dispatch(setUser(profile));
            dispatch(loginAction());
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("🔴 Error validating sesion:", error);
      } finally {
        dispatch(setAuthReady());
      }
    };

    if (!initialVerifyDone.current) {
      initialVerifyDone.current = true;
      verifySession();
    }

    intervalRef.current = setInterval(verifySession, CHECK_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [dispatch, isPublicRoute]);
};

export default useRestoreSession;
