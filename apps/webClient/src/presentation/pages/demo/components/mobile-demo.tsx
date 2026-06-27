import dashboardMobile from "@presentation/assets/dashboard_mobile.png";
import { Plus, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

export function MobileDemo() {
  const { t } = useTranslation();
  return (
    <div className="w-full max-w-md text-primary dark:text-neutral">
      <div className="rounded-lg border bg-card p-6 shadow-xl">
        <h3 className="mb-4 text-xl font-bold">{t("demo.mobileExperience")}</h3>
        <p className="mb-6 text-muted-foreground">
          {t("demo.mobileExperienceDesc")}
        </p>

        {/* Mobile App Preview */}
        <img
          src={dashboardMobile}
          alt={t("demo.mobileScreenshotAlt")}
          className="mx-auto w-80 rounded-md"
          loading="lazy"
        />

        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 shadow-sm bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
              <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="mb-1 text-base font-semibold">
              {t("demo.onTheGoAccess")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("demo.onTheGoAccessDesc")}
            </p>
          </div>
          <div className="rounded-lg border p-4 shadow-sm bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
              <Plus className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="mb-1 text-base font-semibold">
              {t("demo.quickAdd")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("demo.quickAddDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
