import { User } from "@domain/index";
import { DashboardHeader } from "@presentation/components/dashboard/header";
import FooterComponent from "@presentation/components/ui/Footer";
import { Button } from "@presentation/components/ui/button";
import HeaderComponent from "@presentation/components/ui/header";
import { RoutePaths } from "@presentation/utils/routes";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router";

export default function NotFoundPage() {
  const { t } = useTranslation();
  const user = useSelector(
    (state: { auth: { user: User } }) => state.auth.user,
  );
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      {user ? <DashboardHeader /> : <HeaderComponent />}

      {/* Error Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center bg-gradient-to-b from-purple-500 to-cyan-50 dark:from-purple-900 dark:to-slate-900">
        <div className="max-w-md">
          <div className="mb-6 flex justify-center">
            <div className="absolute -inset-0.5 rounded-full bg-purple-600/20 blur-xl dark:bg-red-200/50"></div>
            <div className="relative rounded-full bg-purple-100 p-6 dark:bg-purple-900">
              <span className="text-7xl font-bold text-purple-600 dark:text-purple-400">
                404
              </span>
            </div>
          </div>
          <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl dark:text-neutral">
            {t("errors.notFound")}
          </h1>
          <p className="mb-8 text-muted-foreground">
            {t("errors.notFoundDescription")}
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              onClick={() => window.history.back()}
              size="lg"
              className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("common.goBack")}
            </Button>
            {user ? (
              <Button variant="outline" size="lg">
                <Link to={RoutePaths.App + "/" + RoutePaths.Dashboard}>
                  {t("sidebar.dashboard")}
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="lg">
                <Link to={RoutePaths.Auth + "/" + RoutePaths.Login}>
                  {t("auth.signIn")}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <FooterComponent />
    </div>
  );
}
