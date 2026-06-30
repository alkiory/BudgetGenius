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
