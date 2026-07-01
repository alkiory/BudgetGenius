import { useGetSettings } from "@adapters/query/userQuery";
import MainLayout from "@presentation/layouts/main";
import LoadingPage from "@presentation/pages/loading";
import { APP_PATHS } from "@presentation/utils/routes";
import { Navigate } from "react-router";

/**
 * Onboarding-freshness gate for `/app/*` routes that REQUIRE
 * completed onboarding.
 *
 * Android APK audit, 2026-06: paired with `AuthGuard` to fix a
 * redirect loop. The previous combined `ProtectedRoute` checked
 * both auth and `hasCompletedOnboarding === false`, so a fresh
 * user hitting `/app/dashboard` was redirected to `/app/onboarding`,
 * but the `=== false` gate kept re-firing inside the same guard
 * wrapping the onboarding route itself, looping React Router
 * into a self-redirect until the DOM was emptied.
 *
 * This guard is mounted as a layout-level `<Route element=...>`
 * with NO path, sitting INSIDE `AuthGuard` but OUTSIDE the
 * `/app/onboarding` sibling. So:
 *
 *   /app (AuthGuard)
 *     ├── /app/onboarding  → OnboardingPage directly, no OnboardingGuard
 *     └── <Route element={<OnboardingGuard />}>    (this component)
 *           ├── /app/dashboard → MainLayout + Outlet
 *           ├── /app/transactions
 *           └── ...
 *
 * Fresh user on `/app/dashboard`:
 *   1. AuthGuard sees them as authenticated → Outlet.
 *   2. OnboardingGuard sees `hasCompletedOnboarding === false` →
 *      `<Navigate to="/app/onboarding" replace />`.
 *   3. `/app/onboarding` matches its own sibling route, which is
 *      OUTSIDE OnboardingGuard, so the page renders without
 *      re-entering the same `=== false` check. No loop.
 *
 * User with completed onboarding on `/app/onboarding` direct deep-link:
 *   1. AuthGuard: pass.
 *   2. The `/app/onboarding` sibling is active, not OnboardingGuard.
 *   3. OnboardingPage's own `settings?.hasCompletedOnboarding ===
 *      true` redirect bounces them to `/app/dashboard`.
 *
 * Strict `=== false` check (not `!== true`) so transient settings
 * fetch errors / undefined / null responses never bounce a finished
 * user back to the wizard. Defense-in-depth rationale mirrors the
 * previous `AuthGuard`-and-redirect history.
 */
const OnboardingGuard = () => {
  const { data: settings, isLoading: isSettingsLoading } = useGetSettings();

  if (isSettingsLoading) {
    return <LoadingPage />;
  }

  // Use STRICT `=== false` — undefined / null MUST pass through so a
  // transient settings fetch failure doesn't bounce an existing user
  // back into the wizard they already finished. Same strict-equality
  // rule as the previous combined guard (knowledge.md §6.8 +
  // rpi/mobile-cookies-persistence).
  if (settings?.hasCompletedOnboarding === false) {
    return <Navigate to={APP_PATHS.onboarding} replace />;
  }

  // MainLayout owns its own <Outlet /> in its inner <main>. We MUST NOT
  // pass children here — MainLayout's JSX is hardcoded around its
  // internal Outlet and ignores the children prop, so wrapping
  // `<MainLayout><Outlet /></MainLayout>` would only create a dead
  // React element. Just return <MainLayout /> and let it own the
  // matched child — same pattern the previous ProtectedRoute used.
  return <MainLayout />;
};

export default OnboardingGuard;
