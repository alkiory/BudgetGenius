import AuthLayout from "@presentation/layouts/auth";
import LandingLayout from "@presentation/layouts/landing";
import { lazy } from "react";
import { Route, Routes } from "react-router";

import LoadingPage from "@presentation/pages/loading";
import NotFoundPage from "@presentation/pages/notFound";
import { RootRoute } from "@presentation/pages/splash";
import { RoutePaths } from "@presentation/utils/routes";

import ProtectedRoute from "./protected-route";

// Phase 6.8: every protected + auth + public-chrome route is now
// lazy-loaded so the main entry only carries the layout/loading
// chrome + the provider/state tree. React Router 7's `<Route>`
// handles the `React.lazy()` Suspense boundary internally; the
// React Router 7 `loader` prop on DashboardPage shows a LoadingPage
// during hydration but doesn't gate the lazy chunk fetch.
//
// The vite manualChunks split in vite.config.ts keeps `recharts` +
// `firebase` out of the main entry as separate vendor chunks.
//
// Eager (kept in main entry): these wrap every route above or
// serve as the very first paint on the marketing site.
//   - AuthLayout, LandingLayout, ProtectedRoute, LoadingPage,
//     NotFoundPage, CTAPage (the anon landing is the first paint
//     for first-time visitors; lazy would flash a layout hole
//     before the chunk fetch resolves).
//
// Lazy (per-page chunks that load on navigation):
//   - DashboardPage, ReportsPage, BudgetsPage, TransactionsPage,
//     IncomePage, GoalsPage (dashboard protected routes)
//   - ProfilePage, UserList (user protected routes)
//   - LoginPage, SignupPage, ForgotPasswordPage,
//     ForgotPasswordConfirmationPage, ResetPasswordPage (auth routes)
//   - HowItWorksPage, PrivacyPolicyPage, TermsOfServicePage,
//     ContactSalesPage (Phase 6.8 round-2 polish: these public
//     chrome pages were the last >500 kB source on the main entry;
//     lazy-loading them drops the warning without touching the
//     landing-page first-paint).

// Dashboard protected routes
const DashboardPage = lazy(
  () => import("@presentation/pages/dashboard/dashboardPage"),
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
const UserList = lazy(() => import("@presentation/pages/user/userList"));

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

// Public chrome pages (Phase 6.8 round-2 polish)
const HowItWorksPage = lazy(
  () => import("@presentation/pages/demo/how-it-works"),
);
const PrivacyPolicyPage = lazy(
  () => import("@presentation/pages/contact/privacy-policy-page"),
);
const TermsOfServicePage = lazy(
  () => import("@presentation/pages/contact/terms-of-service-page"),
);
const ContactSalesPage = lazy(
  () => import("@presentation/pages/contact/contact-sales-page"),
);

const RouteConfig = () => {
  return (
    <Routes>
      {/* Rutas públicas. RootRoute renders either the animated SplashPage
          (Capacitor native cold start) or the marketing CTAPage (web + every
          subsequent visit inside the same session). */}
      <Route path={RoutePaths.Home} element={<RootRoute />} />
      <Route element={<LandingLayout />}>
        <Route path={RoutePaths.HowItWorks} element={<HowItWorksPage />} />
        <Route
          path={RoutePaths.PrivacyPolicy}
          element={<PrivacyPolicyPage />}
        />
        <Route
          path={RoutePaths.TersmsAndConditions}
          element={<TermsOfServicePage />}
        />
        <Route path={RoutePaths.ContactSales} element={<ContactSalesPage />} />
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
      {/* Rutas protegidas */}
      <Route path={RoutePaths.App} element={<ProtectedRoute />}>
        {/* dashboard section */}
        <Route
          path={RoutePaths.Dashboard}
          loader={LoadingPage}
          element={<DashboardPage />}
        />
        <Route path={RoutePaths.Transactions} element={<TransactionsPage />} />
        <Route path={RoutePaths.Income} element={<IncomePage />} />
        <Route path={RoutePaths.Budgets} element={<BudgetsPage />} />
        <Route path={RoutePaths.Reports} element={<ReportsPage />} />
        {/* user section */}
        <Route path={RoutePaths.Profile} element={<ProfilePage />} />
        <Route path={RoutePaths.UserList} element={<UserList />} />
        <Route path={RoutePaths.UserDetail} element={<ProfilePage />} />
      </Route>

      {/* Error page */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default RouteConfig;
