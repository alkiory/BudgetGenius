import presentationDashboard from "@presentation/assets/presentation_dashboard.png";
import { BarChart3, CreditCard, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

export function DesktopDemo() {
  const { t } = useTranslation();
  return (
    <div className="w-full max-w-5xl">
      <div className="rounded-lg border p-6 shadow-xl bg-card dark:bg-card">
        <h3 className="mb-4 text-xl font-bold text-primary dark:text-neutral">
          {t("demo.desktopExperience")}
        </h3>
        <p className="mb-6 text-muted-foreground">
          {t("demo.desktopExperienceDesc")}
        </p>

        {/* App Preview */}
        <div className="mt-16 overflow-hidden rounded-lg border bg-background p-2 shadow-xl">
          <img
            src={presentationDashboard}
            alt={t("demo.desktopScreenshotAlt")}
            className="w-full rounded-md"
            loading="lazy"
          />
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-lg border shadow bg-slate-50 p-6 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
            <div className="mb-4 inline-grid h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">
              {t("demo.comprehensiveDashboard")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("demo.comprehensiveDashboardDesc")}
            </p>
          </div>
          <div className="rounded-lg border shadow bg-slate-50 p-6 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
            <div className="mb-4 inline-grid h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
              <CreditCard className="h-5 w-5 text-primary-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">
              {t("demo.transactionTracking")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("demo.transactionTrackingDesc")}
            </p>
          </div>
          <div className="rounded-lg border shadow bg-slate-50 p-6 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
            <div className="mb-4 inline-grid h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">
              {t("demo.financialInsights")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("demo.financialInsightsDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
