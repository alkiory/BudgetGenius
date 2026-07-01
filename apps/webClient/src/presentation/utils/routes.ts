export enum RouteNames {
  Dashboard = "Dashboard",
  Transactions = "Transactions",
  Budgets = "Budgets",
  Reports = "Reports",
  Income = "Income",
  Profile = "Profile",
  Settings = "Settings",
  Login = "Login",
  Signup = "Signup",
  Logout = "Log out",
  PrivacyPolicy = "Privacy Policy",
  TersmsAndConditions = "Terms and conditions",
  ContactSales = "Contact Sales",
  Changelog = "Changelog",
}

export enum RoutePaths {
  Home = "/",
  PrivacyPolicy = "/privacy-policy",
  TersmsAndConditions = "/terms-and-conditions",
  ContactSales = "/contact-sales",
  Changelog = "/changelog",
  // Auth
  Auth = "/auth",
  GoogleAuth = "/auth/firebase-login",
  Login = "login",
  Signup = "signup",
  ForgotPassword = "forgot-password",
  ForgotPasswordConfirmation = "forgot-password/confirmation",
  ResetPassword = "reset-password",
  // Dashboard
  App = "/app",
  Dashboard = "dashboard",
  Onboarding = "onboarding",
  Transactions = "dashboard/transactions",
  Reports = "dashboard/reports",
  Budgets = "dashboard/budgets",
  Income = "dashboard/income",
  // User section
  Profile = "profile",
  UserList = "user",
  UserDetail = "user/:id",
  Settings = "settings",
}

/**
 * Build full app-route paths from the relative segment values in
 * {@link RoutePaths}. Centralised here so that callers that need to
 * redirect to a specific view (e.g. the post-transaction redirect
 * in `add-transaction-modal.tsx`) share the same path string and a
 * future rename of `Dashboard` only needs to be made in one place.
 *
 * Reference: the `RoutePaths.Dashboard = "dashboard"` and
 * `RoutePaths.Transactions = "dashboard/transactions"` segments are
 * relative to `RoutePaths.App = "/app"`, so the full paths become
 * `/app/dashboard` and `/app/dashboard/transactions`.
 *
 * Each helper resolves its segment at module-scope, so it's a frozen
 * constant — no per-render allocation, no risk of stale path strings
 * from closure capture.
 */
export const APP_PATHS = {
  dashboard: `${RoutePaths.App}/${RoutePaths.Dashboard}`,
  transactions: `${RoutePaths.App}/${RoutePaths.Transactions}`,
  onboarding: `${RoutePaths.App}/${RoutePaths.Onboarding}`,
} as const;
