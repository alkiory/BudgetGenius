import { RootState } from "@adapters/store/rootStore";
import MainLayout from "@presentation/layouts/main";
import LoadingPage from "@presentation/pages/loading";
import { RoutePaths } from "@presentation/utils/routes";
import { useSelector } from "react-redux";
import { Navigate } from "react-router";

/**
 * Guards `/app/*` routes.
 *
 * Prior bugs that shaped this implementation:
 * 1. A 1-second `loading` timeout that fired before `/auth/verify` resolved
 *    — slow connections bounced logged-in users to /auth/login on refresh.
 * 2. A polarity-bugged `localStorage.getItem("accessToken")` check that
 *    redirected to login when the token WAS present (dormant now that
 *    tokens live in HTTP-only cookies, but still incorrect).
 * 3. A combined `useSelector((s) => s.auth)` that destructured to a fresh
 *    object every render. react-redux's default `===` comparison sees a
 *    new reference on every store subscription notify and, under React 19
 *    StrictMode, gets stuck in a render loop — the route never paints.
 *
 * The current implementation:
 *   - Uses THREE separate `useSelector` calls so each one returns a leaf
 *     (boolean | User | null). Leaf comparisons via `===` are stable.
 *   - Waits on `state.auth.authReady` (flipped in useRestoreSession's
 *     `finally`, with an 8-second axios timeout backstop).
 *   - Renders `LoadingPage` while the slice is still warming up so the
 *     Outlet never flashes empty.
 */
const ProtectedRoute = () => {
  // Three separate selectors — each returns a leaf value, so react-redux
  // compares via `===` instead of detecting a fresh object every render.
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );
  const user = useSelector((state: RootState) => state.auth.user);
  const authReady = useSelector((state: RootState) => state.auth.authReady);

  if (!authReady) {
    return <LoadingPage />;
  }

  if (!isAuthenticated && !user) {
    return (
      <Navigate to={`${RoutePaths.Auth}/${RoutePaths.Login}`} replace />
    );
  }

  return <MainLayout />;
};

export default ProtectedRoute;
