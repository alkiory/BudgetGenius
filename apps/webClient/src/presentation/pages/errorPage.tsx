import { DashboardHeader } from "@presentation/components/dashboard/header";
import FooterComponent from "@presentation/components/ui/Footer";
import { Button } from "@presentation/components/ui/button";
import HeaderComponent from "@presentation/components/ui/header";
import { AlertTriangle, ArrowLeft, Link, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();
  const isAuthenticated = useSelector(
    (state: { auth: { isAuthenticated: boolean } }) =>
      state.auth.isAuthenticated,
  );

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      {isAuthenticated ? <DashboardHeader /> : <HeaderComponent />}

      {/* Error Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center bg-gradient-to-b from-purple-500 to-cyan-50 dark:from-purple-900 dark:to-slate-900">
        <div className="max-w-md my-5">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-amber-100 p-6">
              <AlertTriangle className="h-12 w-12 text-amber-600 animate-pulse" />
            </div>
          </div>
          <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl text-primary dark:text-neutral">
            {t("errors.errorTitle")}
          </h1>
          <p className="mb-8 text-muted-foreground">
            {t("errors.errorDescription")}
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              onClick={reset}
              size="lg"
              className="bg-purple-600 hover:bg-purple-700"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("common.tryAgain")}
            </Button>
            <Button variant="outline" size="lg">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("errors.backToHome")}
              </Link>
            </Button>
          </div>
          {process.env.NODE_ENV === "development" && (
            <div className="mt-8 rounded-md p-4 text-left bg-slate-50 dark:bg-slate-800 text-primary dark:text-neutral">
              <h2 className="mb-2 text-sm font-semibold">
                {t("errors.errorDetails")}
              </h2>
              <p className="text-xs text-red-600">{error.message}</p>
              {error.stack && (
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-background p-2 text-xs dark:text-neutral">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <FooterComponent />
    </div>
  );
}
