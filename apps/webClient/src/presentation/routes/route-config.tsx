import AuthLayout from "@presentation/layouts/auth";
import LandingLayout from "@presentation/layouts/landing";
import LoadingPage from "@presentation/pages/loading";
import NotFoundPage from "@presentation/pages/notFound";
import { RootRoute } from "@presentation/pages/splash";
import { RoutePaths } from "@presentation/utils/routes";

import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";

import AuthGuard from "./auth-guard";
import OnboardingGuard from "./onboarding-guard";

// Phase 6.8: every protected + auth + public-chrome route is now
// lazy-loaded so the main entry only carries the layout/loading
// chrome + the provider/state tree.
//
// ⚠️ React Router 7 does NOT install a Suspense boundary around
// `React.lazy()` element components automatically. When the lazy
// chunk is being fetched, `React.lazy` throws a Promise that the
// reconciler needs to surface to the nearest `<Suspense>` boundary;
// without one, React 19 routes the throw through the ErrorBoundary
// and the user sees a blank page while the chunk is in flight.
// The single `<Suspense>` wrapper at the top of `RouteConfig` below
// covers every lazy route uniformly. The per-route `loader=
// {LoadingPage}` on DashboardPage / OnboardingPage shows the same
// loading page during the navigation pending state but does NOT
// gate the chunk fetch.
//
// Reference: knowledge.md §6.8 covers the related React 19
// StrictMode `getSnapshot should be cached` failure mode; this
// Suspense wrapper is the symmetric fix for the lazy-chunk-fetch
// failure mode in the same route.
//
// The vite manualChunks split in vite.config.ts keeps `recharts` +
// `firebase` out of the main entry as separate vendor chunks.
//
// Eager (kept in main entry): these wrap every route above or
// serve as the very first paint on the marketing site.
//   - AuthLayout, LandingLayout, AuthGuard, OnboardingGuard,
//     LoadingPage, NotFoundPage, CTAPage (the anon landing is
//     the first paint for first-time visitors; lazy would flash
//     a layout hole before the chunk fetch resolves).
//
// Lazy (per-page chunks that load on navigation):
//   - DashboardPage, ReportsPage, BudgetsPage, TransactionsPage,
//     IncomePage, GoalsPage (dashboard protected routes)
//   - ProfilePage, UserList (user protected routes)
//   - LoginPage, SignupPage, ForgotPasswordPage,
//     ForgotPasswordConfirmationPage, ResetPasswordPage (auth routes)
//   - PrivacyPolicyPage, TermsOfServicePage, ContactSalesPage (Phase 6.8
//     round-2 polish: these public
//     chrome pages were the last >500 kB source on the main entry;
//     lazy-loading them drops the warning without touching the
//     landing-page first-paint).

// Dashboard protected routes
const DashboardPage = lazy(
  () => import("@presentation/pages/dashboard/dashboardPage"),
);
const OnboardingPage = lazy(
  () => import("@presentation/pages/onboarding/onboardingPage"),
);
const ReportsPage = lazy(
  () => import("@presentation/pages/dashboard/reportsPage"),
);
const BudgetsPage = lazy(
  () => import("@presentation/pages/dashboard/budgetsPage"),
);
const TransactionsPage = lazy(
  () => import("@presentation/pages/dashboard/transactionPage"),
);
const IncomePage = lazy(
  () => import("@presentation/pages/dashboard/incomePage"),
);

// User protected routes
const ProfilePage = lazy(() => import("@presentation/pages/user/profile"));

// Auth routes
const LoginPage = lazy(() => import("@presentation/pages/auth/login"));
const SignupPage = lazy(() => import("@presentation/pages/auth/signup"));
const ForgotPasswordPage = lazy(
  () => import("@presentation/pages/auth/forgot-password"),
);
const ForgotPasswordConfirmationPage = lazy(
  () => import("@presentation/pages/auth/confirmation"),
);
const ResetPasswordPage = lazy(
  () => import("@presentation/pages/auth/reset-password"),
);

// Public chrome pages
// How-it-works lives as a section on the landing page (no standalone route
// since the v1.4+ redesign). See presentation/components/landing/how-it-works.tsx.
const PrivacyPolicyPage = lazy(
  () => import("@presentation/pages/contact/privacy-policy-page"),
);
const TermsOfServicePage = lazy(
  () => import("@presentation/pages/contact/terms-of-service-page"),
);
const ContactSalesPage = lazy(
  () => import("@presentation/pages/contact/contact-sales-page"),
);
const ChangelogPage = lazy(() => import("@presentation/pages/changelog"));

const RouteConfig = () => {
  // Single Suspense boundary covering every React.lazy()-loaded
  // route below. Without this, lazy chunk throws during the
  // initial render route to ErrorBoundary (blank page symptom
  // on the onboarding route — Android APK audit 2026-06).
  return (
    <Suspense fallback={<LoadingPage />}>
      <Routes>
        {/* Rutas públicas. RootRoute renders either the animated SplashPage
          (Capacitor native cold start) or the marketing CTAPage (web + every
          subsequent visit inside the same session). */}
        <Route path={RoutePaths.Home} element={<RootRoute />} />
        <Route element={<LandingLayout />}>
          <Route
            path={RoutePaths.PrivacyPolicy}
            element={<PrivacyPolicyPage />}
          />
          <Route
            path={RoutePaths.TersmsAndConditions}
            element={<TermsOfServicePage />}
          />
          <Route
            path={RoutePaths.ContactSales}
            element={<ContactSalesPage />}
          />
          <Route path={RoutePaths.Changelog} element={<ChangelogPage />} />
        </Route>
        <Route path={RoutePaths.Auth} element={<AuthLayout />}>
          <Route path={RoutePaths.Login} element={<LoginPage />} />
          <Route path={RoutePaths.Signup} element={<SignupPage />} />
          <Route
            path={RoutePaths.ForgotPassword}
            element={<ForgotPasswordPage />}
          />
          <Route
            path={RoutePaths.ForgotPasswordConfirmation}
            element={<ForgotPasswordConfirmationPage />}
          />
          <Route
            path={RoutePaths.ResetPassword}
            element={<ResetPasswordPage />}
          />
        </Route>
        {/* Rutas protegidas. Android APK audit, 2026-06: TWO-GUARD
            split. The /app parent only checks authentication
            (AuthGuard). /app/onboarding sits OUTSIDE the
            OnboardingGuard so the wizard never re-evaluates the
            `=== false` redirect against itself — which was the
            root cause of the DOM-empty bug (the previous combined
            ProtectedRoute caused an infinite <Navigate> to self
            whenever a fresh user hit any /app/* route). The rest
            of /app/* (dashboard, transactions, etc.) sits inside
            OnboardingGuard, which renders the MainLayout chrome
            and bounces non-onboarded users to the wizard. */}
        <Route path={RoutePaths.App} element={<AuthGuard />}>
          {/* Onboarding wizard: AuthGuard gates auth, the
              OnboardingPage itself reads settings and bounces
              already-onboarded users back to /app/dashboard. No
              onboarding gate here. */}
          <Route
            path={RoutePaths.Onboarding}
            loader={LoadingPage}
            element={<OnboardingPage />}
          />
          {/* All other /app/* routes: OnboardingGuard renders
              the MainLayout chrome and gates the
              `=== false` redirect. */}
          <Route element={<OnboardingGuard />}>
            {/* dashboard section */}
            <Route
              path={RoutePaths.Dashboard}
              loader={LoadingPage}
              element={<DashboardPage />}
            />
            <Route
              path={RoutePaths.Transactions}
              element={<TransactionsPage />}
            />
            <Route path={RoutePaths.Income} element={<IncomePage />} />
            <Route path={RoutePaths.Budgets} element={<BudgetsPage />} />
            <Route path={RoutePaths.Reports} element={<ReportsPage />} />
            {/* user section */}
            <Route path={RoutePaths.Profile} element={<ProfilePage />} />
            <Route path={RoutePaths.UserDetail} element={<ProfilePage />} />
          </Route>
        </Route>

        {/* Error page */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};

export default RouteConfig;
