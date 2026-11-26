import { RootState } from "@adapters/store/rootStore";
import { RoutePaths } from "@presentation/utils/routes";
import { useSelector } from "react-redux";
import { Navigate, Outlet } from "react-router";

/**
 * Gates the backoffice on the `superadmin` role.
 *
 * The API is the real boundary (every `/superadmin/*` route enforces the role
 * server-side); this guard only keeps a normal account from rendering a panel
 * whose requests would all 403.
 */
export default function SuperAdminGuard() {
  const user = useSelector((state: RootState) => state.auth.user);

  // While the session is still loading `user` is null; the parent AuthGuard /
  // OnboardingGuard already owns that state, so render through.
  if (user && user.role !== "superadmin") {
    return (
      <Navigate
        to={`${RoutePaths.App}/${RoutePaths.Dashboard}`}
        replace
        state={{ denied: "superadmin" }}
      />
    );
  }

  return <Outlet />;
}
