import { useLocale } from "@adapters/hooks/useLocale";
import { periodTranslationKey } from "@domain/dashboard/budgets/budget.entity";
import { Button } from "@presentation/components/ui/button";
import { CalendarIcon, Edit2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function BudgetHeader({
  name,
  startDate,
  endDate,
  period,
  handleEditBudgetClick,
}: {
  name: string;
  startDate: Date;
  endDate: Date;
  period: string;
  handleEditBudgetClick: () => void;
}) {
  const { t } = useTranslation();
  // Hook reads `state.userSettings.settings.locale` (BCP-47 tag)
  // with `"en-US"` fallback while the slice still holds the empty
  // initial locale. Replacing the previous bare
  // `new Date(x).toLocaleDateString()` calls — which used the
  // browser default locale — is what fixes the English dates on a
  // Spanish-UI dashboard.
  const locale = useLocale();
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="break-words text-xl font-semibold">{name}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="min-w-0">
            {new Date(startDate).toLocaleDateString(locale)} -{" "}
            {new Date(endDate).toLocaleDateString(locale)}
          </span>
          <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-700">
            {t(`periods.${periodTranslationKey(period)}`)}
          </span>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 gap-1"
        onClick={handleEditBudgetClick}
      >
        <Edit2 className="h-4 w-4" />
        {t("budgets.editBudget")}
      </Button>
    </div>
  );
}
