import { RootState } from "@adapters/store/rootStore";
import MainLayout from "@presentation/layouts/main";
import LoadingPage from "@presentation/pages/loading";
import { RoutePaths } from "@presentation/utils/routes";
import { useSelector } from "react-redux";
import { Navigate } from "react-router";

/**
 * Guards `/app/*` routes.
 *
 * Two prior bugs surfaced in production:
 * 1. A 1-second `loading` timeout that fired before `/auth/verify` could
 *    return — slow networks bounced logged-in users to /auth/login on
 *    refresh.
 * 2. A polarity-bugged `if (token)` check that read
 *    `localStorage.getItem("accessToken")` and redirected to login when
 *    the token WAS present. The backend has long since moved tokens into
 *    HTTP-only cookies (see api/src/infrastructure/config/cookie.service.ts
 *    + app.module.ts cookieOptions), so the localStorage branch was dormant
 *    but still incorrect.
 *
 * The new implementation waits on `state.auth.authReady`, which
 * `useRestoreSession` flips in its `finally` block regardless of whether
 * /auth/verify succeeded or failed. While the slice is still warming up
 * we render the existing `LoadingPage` chrome so the dashboard never
 * flashes an empty Outlet.
 */
const ProtectedRoute = () => {
  const { isAuthenticated, user, authReady } = useSelector(
    (state: RootState) => state.auth,
  );

  // While the auth slice is still restoring the session, show the loading
  // chrome instead of flashing an empty Outlet or bouncing prematurely.
  if (!authReady) {
    return <LoadingPage />;
  }

  // The slice is settled — auth resolution is final. If neither
  // `isAuthenticated` nor a cached user profile survived, redirect.
  if (!isAuthenticated && !user) {
    return (
      <Navigate to={`${RoutePaths.Auth}/${RoutePaths.Login}`} replace />
    );
  }

  return <MainLayout />;
};

export default ProtectedRoute;
