import { setUser } from "@adapters/slices/auth/authSlice";
import api from "@infrastructure/api.config";
import { RoutePaths } from "@presentation/utils/routes";
import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { useLocation } from "react-router";

const useRestoreSession = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const intervalRef = useRef<NodeJS.Timeout>(null);
  const initialVerifyDone = useRef(false);
  const lastVerifyCallRef = useRef(0);

  // 1. Evitar verificación en rutas públicas
  const PUBLIC_ROUTES = [
    RoutePaths.Home,
    RoutePaths.HowItWorks,
    RoutePaths.Upgrade,
    RoutePaths.PrivacyPolicy,
    RoutePaths.TersmsAndConditions,
    RoutePaths.ContactSales,
    `${RoutePaths.Auth}/${RoutePaths.Login}`,
    `${RoutePaths.Auth}/${RoutePaths.Signup}`,
    `${RoutePaths.Auth}/${RoutePaths.ForgotPassword}`,
    `${RoutePaths.Auth}/${RoutePaths.ForgotPasswordConfirmation}`,
    `${RoutePaths.Auth}/${RoutePaths.ResetPassword}`,
  ];
  const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname);

  useEffect(() => {
    if (isPublicRoute) {
      initialVerifyDone.current = false;
      return;
    }

    // 2. Intervalo de verificación (5 minutos)
    const CHECK_INTERVAL = 5 * 60 * 1000;

    const verifySession = async () => {
      // Throttle: saltar si la última llamada fue hace menos de 30 segundos
      const THROTTLE_MS = 30 * 1000;
      const now = Date.now();
      if (now - lastVerifyCallRef.current < THROTTLE_MS) {
        return;
      }
      lastVerifyCallRef.current = now;

      try {
        const response = await api.get("/auth/verify");

        if (response.status === 200) {
          const userProfile = await api.get("/user/profile");
          dispatch(setUser(userProfile.data));
        }
      } catch (error) {
        console.error("🔴 Error validating sesion:", error);
        // Network errors are handled by the axios interceptor (offline queue)
      }
    };

    // Solo verificar inmediatamente en el primer montaje o al volver de ruta pública
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
      }
    };
  }, [dispatch, isPublicRoute]);
};

export default useRestoreSession;
