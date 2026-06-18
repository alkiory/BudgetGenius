import { useFetchBudgets } from "@adapters/query/dashboard";
import { RootState } from "@adapters/store/rootStore";
import { OverBudgetIcon } from "@presentation/components/ui/budget-status";
import getColorBasedOnEndDate from "@presentation/utils/colorGeneratorBasedOnDate";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { RoutePaths } from "@presentation/utils/routes";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router";
import Loader from "../loader";

export function BudgetProgress() {
  const { t } = useTranslation();
  const { data: budgets, isLoading, isSuccess } = useFetchBudgets();
  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting;

  const displayedBudgets = budgets?.slice(-1 * 3) || [];
  const hasOverBudget = displayedBudgets.some(
    (b) => b.totalSpent > b.totalAllocated,
  );

  return (
    <div
      className={`rounded-lg p-6 shadow-sm transition-colors ${
        hasOverBudget
          ? "border border-red-300 bg-red-50/80 dark:border-red-800 dark:bg-red-950/30"
          : "bg-white dark:bg-slate-800"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <OverBudgetIcon isOverBudget={hasOverBudget} size="md" />
          <h2 className="text-lg font-semibold">
            {t("dashboard.budgetProgress")}
          </h2>
        </div>
        <Link
          to={RoutePaths.App + "/" + RoutePaths.Budgets}
          className="text-sm text-purple-600 hover:underline dark:text-purple-400"
        >
          {t("dashboard.manageBudgets")}
        </Link>
      </div>
      <div className="space-y-4">
        {isLoading && <Loader />}
        {isSuccess && budgets?.length > 0 ? (
          budgets?.slice(-1 * 3)?.map((budget) => {
            const percentage = Math.min(
              Math.round((budget.totalSpent / budget.totalAllocated) * 100),
              100,
            );
            const isOverBudget = budget.totalSpent > budget.totalAllocated;

            const targetCurrency = (settings?.currency || "USD") as Currency;

            const formattedSpent = currencyService.formatCurrency(
              budget.totalSpent,
              "USD" as Currency,
              targetCurrency,
              false,
            );

            const formattedAllocated = currencyService.formatCurrency(
              budget.totalAllocated,
              "USD" as Currency,
              targetCurrency,
              false,
            );

            return (
              <div key={budget.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{budget.name}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {formattedSpent.formatted} / {formattedAllocated.formatted}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                  <div
                    className={`h-2 rounded-full progress-shim ${
                      isOverBudget
                        ? "bg-red-500"
                        : getColorBasedOnEndDate(budget.endDate)
                    }`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <div className="mt-1 flex justify-between text-xs">
                  <span
                    className={
                      isOverBudget
                        ? "text-red-500 dark:text-red-400"
                        : "text-slate-500 dark:text-slate-400"
                    }
                  >
                    {percentage}% {isOverBudget && t("dashboard.overBudget")}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {Math.max(
                      formattedAllocated.amount - formattedSpent.amount,
                      0,
                    )}{" "}
                    {t("dashboard.left")}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex items-center justify-center">
            <span className="text-muted-foreground">
              {t("dashboard.noBudgetsYet")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
