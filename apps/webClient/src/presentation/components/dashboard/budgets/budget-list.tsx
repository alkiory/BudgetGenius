import { useUserSettings } from "@adapters/hooks/useUserSettings";
import { Budget } from "@domain/dashboard/budgets/budget.entity";
import Loader from "@presentation/components/loader";
import { OverBudgetIcon } from "@presentation/components/ui/budget-status";
import { Button } from "@presentation/components/ui/button";
import {
  currencyService,
  toCurrency,
} from "@presentation/utils/currencyService";
import { CalendarIcon, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

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

  // `settings` covers both fields this list needs in one Redux
  // subscription: `settings?.currency` for the formatted values
  // below and `settings?.locale` for the date range rendering. The
  // previous version used `useSelector + useLocale()` (two
  // subscriptions) plus a destructure — `useUserSettings()` collapses
  // all of that into a single `useSelector` call.
  const settings = useUserSettings();
  const locale = settings?.locale || "en-US";

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
            const percentSpent =
              budget.totalAllocated > 0
                ? (budget.totalSpent / budget.totalAllocated) * 100
                : 0;
            const remaining = budget.totalAllocated - budget.totalSpent;

            // The api `Budget` entity has no `currency` column (only
            // the child `BudgetCategory` table got one in migration
            // 1800000000004), so the totals returned from the backend
            // are USD-normalized at the source — the same convention
            // `budget-summary.tsx` uses — and we MUST convert from
            // USD to the user's target currency. The previous version
            // of this file used from === to === target, which made
            // the conversion a no-op and a USD-budget user viewing
            // in EUR would see USD-formatted numbers with EUR locale
            // grouping. `toCurrency(...)` keeps the settings-read
            // path type-safe even if the setting is ever-shaped as an
            // unknown value.
            const targetCurrency = toCurrency(settings?.currency);
            const sourceCurrency = "USD";
            // `remaining` can be negative (over budget). We pass
            // `Math.abs(remaining)` to the formatter and `showSign:
            // false` so the formatted string is always the magnitude
            // (`$50.00`); the sign is then applied in the JSX
            // (`-$50.00 over budget` for negatives, `$50.00
            // Disponible` for positives). This avoids the
            // `formatCurrency(showSign: true)` + manual
            // `stripLeadingPlus` hack and keeps the formatter
            // behavior consistent with `totalSpent` and
            // `totalAllocated` (also `showSign: false`).
            const formattedRemaining = currencyService.formatCurrency(
              Math.abs(remaining),
              sourceCurrency,
              targetCurrency,
              false,
            );
            const formattedAllocated = currencyService.formatCurrency(
              budget.totalAllocated,
              sourceCurrency,
              targetCurrency,
              false,
            );
            const formattedSpent = currencyService.formatCurrency(
              budget.totalSpent,
              sourceCurrency,
              targetCurrency,
              false,
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
                  {/* `locale` is the dashboard-wide BCP-47 tag from
                      `useLocale()`; bare `toLocaleDateString()` here
                      used to fall back to the browser default, which
                      rendered English dates on the Spanish-UI dashboard. */}
                  <span>
                    {new Date(budget.startDate).toLocaleDateString(locale)} -{" "}
                    {new Date(budget.endDate).toLocaleDateString(locale)}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {t("budgets.spentLabel")}:{" "}
                        </span>
                        <span className="font-medium">
                          {formattedSpent.formatted}
                        </span>
                      </span>
                      <span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {t("budgets.limitLabel")}:{" "}
                        </span>
                        <span className="font-medium">
                          {formattedAllocated.formatted}
                        </span>
                      </span>
                    </div>
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
                      ? t("budgets.availableAmount", {
                          amount: formattedRemaining.formatted,
                        })
                      : t("budgets.amountOverBudget", {
                          amount: `-${formattedRemaining.formatted}`,
                        })}
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
