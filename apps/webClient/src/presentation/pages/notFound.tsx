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
      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center bg-gradient-to-b from-teal-500/15 to-background dark:from-teal-950/50 dark:to-slate-950">
        <div className="max-w-md">
          <div className="mb-6 flex justify-center">
            <div className="absolute -inset-0.5 rounded-full bg-teal-500/20 blur-xl dark:bg-teal-400/20"></div>
            <div className="relative rounded-full bg-teal-500/10 p-6 dark:bg-teal-400/15">
              <span className="text-7xl font-bold text-teal-600 dark:text-teal-400">
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
              className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("common.goBack")}
            </Button>
            {user ? (
              <Button variant="outline" size="lg">
                <Link to={RoutePaths.App + "/" + RoutePaths.Dashboard}>
                  {t("routes.app.dashboard.dashboard")}
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
