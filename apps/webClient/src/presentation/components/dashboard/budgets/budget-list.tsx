import { useUserSettings } from "@adapters/hooks/useUserSettings";
import { Budget } from "@domain/dashboard/budgets/budget.entity";
import Loader from "@presentation/components/loader";
import { OverBudgetIcon } from "@presentation/components/ui/budget-status";
import { Button } from "@presentation/components/ui/button";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { CalendarIcon, Pencil, Trash2 } from "@presentation/components/ui/animated-icons";
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
            const isSavings = budget.type === "savings";
            const percentSpent =
              budget.totalAllocated > 0
                ? (budget.totalSpent / budget.totalAllocated) * 100
                : 0;
            const remaining = budget.totalAllocated - budget.totalSpent;

            // Currency selection affects formatting only; budget values
            // are passed through unchanged.
            const targetCurrency = (settings?.currency || "EUR") as Currency;
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
              targetCurrency,
              false,
            );
            const formattedAllocated = currencyService.formatCurrency(
              budget.totalAllocated,
              targetCurrency,
              false,
            );
            const formattedSpent = currencyService.formatCurrency(
              budget.totalSpent,
              targetCurrency,
              false,
            );

            // Savings goals fill up green and are never "over budget".
            let progressColor = "bg-emerald-500";
            if (!isSavings && percentSpent > 90) {
              progressColor = "bg-rose-500";
            } else if (!isSavings && percentSpent > 75) {
              progressColor = "bg-yellow-500";
            }

            const isOverBudget =
              !isSavings && budget.totalSpent > budget.totalAllocated;
            const isActiveBudget = activeBudget?.id === budget.id;

            let borderClasses =
              "border-slate-200/90 bg-white/85 shadow-[0_18px_45px_-30px_rgb(15_23_42_/_0.35)] backdrop-blur hover:border-teal-400/40 dark:border-white/[0.08] dark:bg-white/[0.03] dark:shadow-[0_24px_60px_-32px_rgb(0_0_0_/_0.95)] dark:hover:border-teal-400/30";
            if (isActiveBudget) {
              borderClasses =
                "border-teal-400/60 bg-teal-500/10 shadow-[0_18px_45px_-30px_rgb(15_23_42_/_0.35)] backdrop-blur dark:border-teal-400/50 dark:bg-teal-400/[0.08] dark:shadow-[0_24px_60px_-32px_rgb(0_0_0_/_0.95)]";
            }
            if (isOverBudget) {
              borderClasses =
                "border-rose-300 bg-rose-50/80 shadow-[0_18px_45px_-30px_rgb(15_23_42_/_0.35)] backdrop-blur dark:border-rose-500/40 dark:bg-rose-950/30 dark:shadow-[0_24px_60px_-32px_rgb(0_0_0_/_0.95)]";
              if (isActiveBudget) {
                borderClasses =
                  "border-rose-400 bg-rose-50 ring-1 ring-rose-400/50 dark:border-rose-500/60 dark:bg-rose-950/40";
              }
            }

            return (
              <div
                key={budget.id}
                className={`cursor-pointer rounded-xl border p-4 transition-colors ${borderClasses}`}
                onClick={() => handleSelectBudget(budget)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <OverBudgetIcon isOverBudget={isOverBudget} size="sm" />
                    <h3
                      className="min-w-0 truncate font-medium"
                      title={budget.name}
                    >
                      {budget.name}
                    </h3>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
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
                      className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBudget(budget.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <CalendarIcon className="h-3 w-3 shrink-0" />
                  {/* `locale` is the dashboard-wide BCP-47 tag from
                      `useLocale()`; bare `toLocaleDateString()` here
                      used to fall back to the browser default, which
                      rendered English dates on the Spanish-UI dashboard. */}
                  <span className="min-w-0">
                    {new Date(budget.startDate).toLocaleDateString(locale)} -{" "}
                    {new Date(budget.endDate).toLocaleDateString(locale)}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {isSavings
                            ? t("budgets.savedLabel")
                            : t("budgets.spentLabel")}
                          :{" "}
                        </span>
                        <span className="font-medium">
                          {formattedSpent.formatted}
                        </span>
                      </span>
                      <span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {isSavings
                            ? t("budgets.goalLabel")
                            : t("budgets.limitLabel")}
                          :{" "}
                        </span>
                        <span className="font-medium">
                          {formattedAllocated.formatted}
                        </span>
                      </span>
                    </div>
                    <span className="shrink-0 font-medium">
                      {Math.round(percentSpent)}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/[0.07]">
                    <div
                      className={`h-2 rounded-full ${progressColor}`}
                      style={{ width: `${Math.min(percentSpent, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="mt-2 text-sm">
                  <span
                    className={
                      remaining >= 0 || isSavings
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }
                  >
                    {remaining >= 0
                      ? isSavings
                        ? t("budgets.goalRemaining", {
                            amount: formattedRemaining.formatted,
                          })
                        : t("budgets.availableAmount", {
                            amount: formattedRemaining.formatted,
                          })
                      : isSavings
                      ? t("budgets.goalReached")
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
        <div className="rounded-xl border border-dashed border-slate-200 bg-teal-500/10 p-6 text-center dark:border-teal-400/15 dark:bg-teal-400/10 md:p-10 md:text-left lg:p-16 xl:p-20">
          <p className="text-slate-500 dark:text-slate-400">
            {t("budgets.noBudgetsFound")}
          </p>
        </div>
      )}
    </div>
  );
}
