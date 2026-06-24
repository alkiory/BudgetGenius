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
        const response = await api.get("/auth/verify", { _retry: true });

        if (response.status === 200) {
          const userProfile = await api.get("/user/profile", {
            _retry: true,
          });
          const profile = userProfile?.data;
          if (profile) {
            dispatch(setUser(profile));
            dispatch(loginAction());
          }
        }
      } catch (error) {
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
