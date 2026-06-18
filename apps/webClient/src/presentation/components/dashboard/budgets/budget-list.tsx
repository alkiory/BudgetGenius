import { RootState } from "@adapters/store/rootStore";
import { Budget } from "@domain/dashboard/budgets/budget.entity";
import Loader from "@presentation/components/loader";
import { OverBudgetIcon } from "@presentation/components/ui/budget-status";
import { Button } from "@presentation/components/ui/button";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { CalendarIcon, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

interface BudgetListProps {
  budgets: Budget[];
  isLoading: boolean;
  onBudgetSelect: (budget: Budget) => void;
  onEditBudget: (budget: Budget) => void;
  onDeleteBudget: (budgetId: string | number) => void;
}

export function BudgetList({
  onBudgetSelect,
  onEditBudget,
  onDeleteBudget,
  budgets,
  isLoading,
}: BudgetListProps) {
  const { t } = useTranslation();
  const [activeBudget, setActiveBudget] = useState<Budget | null>(null);

  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting;

  const handleSelectBudget = (budget: Budget) => {
    setActiveBudget(budget);
    onBudgetSelect(budget);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t("common.yourBudgets")}</h2>

      {isLoading && <Loader />}

      {budgets && budgets.length > 0 ? (
        <div className="space-y-2">
          {budgets.map((budget) => {
            const isActive = activeBudget?.id === budget.id;
            const percentSpent =
              budget.totalAllocated > 0
                ? (budget.totalSpent / budget.totalAllocated) * 100
                : 0;
            const remaining = budget.totalAllocated - budget.totalSpent;

            const formattedRemaining = currencyService.formatCurrency(
              remaining,
              settings?.currency as Currency,
              settings?.currency as Currency,
            );

            const targetCurrency = (settings?.currency || "USD") as Currency;
            const formattedAllocated = currencyService.formatCurrency(
              budget.totalAllocated,
              targetCurrency as Currency,
              targetCurrency,
            );

            const formattedSpent = currencyService.formatCurrency(
              budget.totalSpent,
              targetCurrency as Currency,
              targetCurrency,
            );

            // Determine progress color based on percentage spent
            let progressColor = "bg-green-500";
            if (percentSpent > 90) {
              progressColor = "bg-red-500";
            } else if (percentSpent > 75) {
              progressColor = "bg-yellow-500";
            }

            const isOverBudget = budget.totalSpent > budget.totalAllocated;
            const isActiveBudget = activeBudget?.id === budget.id;

            let borderClasses =
              "border-slate-200 bg-white hover:border-purple-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-purple-700";
            if (isActiveBudget) {
              borderClasses =
                "border-purple-500 bg-purple-50 dark:border-purple-500 dark:bg-purple-900/20";
            }
            if (isOverBudget) {
              borderClasses =
                "border-red-300 bg-red-50/80 dark:border-red-800 dark:bg-red-950/40";
              if (isActiveBudget) {
                borderClasses =
                  "border-red-400 bg-red-50 dark:border-red-500 dark:bg-red-950/60 ring-1 ring-red-400/50";
              }
            }

            return (
              <div
                key={budget.id}
                className={`rounded-lg border p-4 transition-colors cursor-pointer ${borderClasses}`}
                onClick={() => handleSelectBudget(budget)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <OverBudgetIcon isOverBudget={isOverBudget} size="sm" />
                    <h3 className="font-medium">{budget.name}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditBudget(budget);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBudget(budget.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <CalendarIcon className="h-3 w-3" />
                  <span>
                    {new Date(budget.startDate).toLocaleDateString()} -{" "}
                    {new Date(budget.endDate).toLocaleDateString()}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      ${formattedSpent.formatted.split("+")[1]} of $
                      {formattedAllocated.formatted.split("+")[1]}
                    </span>
                    <span className="font-medium">
                      {Math.round(percentSpent)}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className={`h-2 rounded-full ${progressColor}`}
                      style={{ width: `${Math.min(percentSpent, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="mt-2 text-sm">
                  <span
                    className={
                      remaining >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }
                  >
                    {remaining >= 0
                      ? `${formattedRemaining.formatted.split("+")[1]} ${t(
                          "budgets.remaining",
                        )}`
                      : `${Math.abs(formattedRemaining.amount).toFixed(2)} ${t(
                          "dashboard.overBudget",
                        )}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-purple-50 p-6 text-center dark:border-purple-900/30 dark:bg-purple-900/20 md:p-10 md:text-left lg:p-16 xl:p-20 border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400">
            {t("budgets.noBudgetsFound")}
          </p>
        </div>
      )}
    </div>
  );
}
