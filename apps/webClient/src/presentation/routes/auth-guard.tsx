import { RootState } from "@adapters/store/rootStore";
import LoadingPage from "@presentation/pages/loading";
import { RoutePaths } from "@presentation/utils/routes";
import { useSelector } from "react-redux";
import { Navigate, Outlet } from "react-router";

/**
 * Auth-only gate for every `/app/*` route.
 *
 * Android APK audit, 2026-06: this is the first of TWO guards
 * that now sit between the user and the dashboard. The reason
 * for the split is the redirect loop documented in
 * `route-config.tsx`: the previous single `ProtectedRoute` checked
 * BOTH auth AND `hasCompletedOnboarding === false`. Since
 * `/app/onboarding` lived INSIDE the `/app` element, a fresh user
 * hitting `/app/dashboard` caused the guard to redirect them to
 * `/app/onboarding`, where the same guard re-evaluated the same
 * false payload and redirected again — an infinite `<Navigate>`
 * to self that React Router aborts by leaving the DOM empty.
 *
 * This guard ONLY reads auth state. The onboarding-freshness
 * check lives in `OnboardingGuard` (apps/webClient/src/presentation/
 * routes/onboarding-guard.tsx), which is mounted as a SIBLING of
 * `/app/onboarding` inside this guard's `<Outlet />` so the wizard
 * itself is never re-evaluated against `=== false` and never loops.
 *
 * Pattern notes preserved from the previous combined guard:
 *   - Three separate `useSelector` calls (one per leaf) so each
 *     returns a stable `===`-able value. The 2026-06 React 19
 *     "getSnapshot should be cached" trap is documented in
 *     knowledge.md §6.8.
 *   - Waits on `state.auth.authReady` before deciding.
 *   - Renders `LoadingPage` while warming up so the Outlet never
 *     flashes empty.
 */
const AuthGuard = () => {
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );
  const user = useSelector((state: RootState) => state.auth.user);
  const authReady = useSelector((state: RootState) => state.auth.authReady);

  if (!authReady) {
    return <LoadingPage />;
  }

  if (!isAuthenticated && !user) {
    return <Navigate to={`${RoutePaths.Auth}/${RoutePaths.Login}`} replace />;
  }

  return <Outlet />;
};

export default AuthGuard;
