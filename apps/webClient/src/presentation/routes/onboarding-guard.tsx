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
 * Android APK dev audit, 2026-07: v1.7.0 production regression — the
 * strict `=== false` predicate silently allowed brand-new mobile
 * users (eager-create succeeded server-side but the first
 * `useGetSettings()` round-trip transiently failed or its cache was
 * empty + `data` undefined) to slip past the wizard and land on
 * `/app/dashboard` with hardcoded defaults. Fix: invert the gate to
 * `!== true` so ANY non-confirmed-completed state routes to
 * `/app/onboarding`. The wizard's own inverse check
 * (`settings?.hasCompletedOnboarding` truthy → Navigate to dashboard)
 * immediately bounces finished users back, so the latency cost is
 * one extra render cycle, never a user-visible detour.
 */
const OnboardingGuard = () => {
  const { data: settings, isLoading: isSettingsLoading } = useGetSettings();

  if (isSettingsLoading) {
    return <LoadingPage />;
  }

  // Use `!== true` (positive-confirmation) rather than `=== false`
  // (negative-confirmation). The previous strict-negative rule was
  // correct for an "existing user, transient fetch failure" scenario
  // but SILENTLY FAILED OPEN for a "fresh user, transient /user-settings
  // 401 mid-cache-warmup" — exactly the Capacitor APK cold-start path
  // where Android WebView's missing cookie + Authorization header
  // round-trip produced an empty `data` payload. With `!== true`:
  //   - fresh user + data=false          → redirect to onboarding ✓
  //   - fresh user + data=undefined      → redirect to onboarding ✓
  //   - finished user + data=true        → MainLayout (dashboard) ✓
  //   - finished user + data=undefined   → redirect → wizard's own
  //                                          `=== true` redirect sends
  //                                          them back in <1 frame ✓
  if (settings?.hasCompletedOnboarding !== true) {
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
