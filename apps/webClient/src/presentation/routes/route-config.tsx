import AuthLayout from "@presentation/layouts/auth";
import ForgotPasswordConfirmationPage from "@presentation/pages/auth/confirmation";
import ForgotPasswordPage from "@presentation/pages/auth/forgot-password";
import LoginPage from "@presentation/pages/auth/login";
import ResetPasswordPage from "@presentation/pages/auth/reset-password";
import SignupPage from "@presentation/pages/auth/signup";
import ContactSalesPage from "@presentation/pages/contact/contact-sales-page";
import PrivacyPolicyPage from "@presentation/pages/contact/privacy-policy-page";
import TermsOfServicePage from "@presentation/pages/contact/terms-of-service-page";
import CTAPage from "@presentation/pages/cta";
import { lazy } from "react";
import { Route, Routes } from "react-router";
import ProfilePage from "@presentation/pages/user/profile";

import ProtectedRoute from "./protected-route";
import UserList from "@presentation/pages/user/userList";
import HowItWorksPage from "@presentation/pages/demo/how-it-works";
import NotFoundPage from "@presentation/pages/notFound";
const DashboardPage = lazy(
  () => import("@presentation/pages/dashboard/dashboardPage"),
);
import { RoutePaths } from "@presentation/utils/routes";
import LoadingPage from "@presentation/pages/loading";
import ReportsPage from "@presentation/pages/dashboard/reportsPage";
import TransactionsPage from "@presentation/pages/dashboard/transactionPage";
import IncomePage from "@presentation/pages/dashboard/incomePage";
import BudgetsPage from "@presentation/pages/dashboard/budgetsPage";
import { GoalsPage } from "@presentation/pages/dashboard/goalsPage";
import LandingLayout from "@presentation/layouts/landing";

const RouteConfig = () => {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path={RoutePaths.Home} element={<CTAPage />} />
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
        <Route path={RoutePaths.Goals} element={<GoalsPage />} />
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
