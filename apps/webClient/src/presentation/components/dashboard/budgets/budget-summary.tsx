import { RootState } from "@adapters/store/rootStore";
import { BudgetType } from "@domain/dashboard/budgets/budget.entity";
import {
  OverBudgetContainer,
  OverBudgetIcon,
} from "@presentation/components/ui/budget-status";
import { currencyService } from "@presentation/utils/currencyService";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

export default function BudgetSummary({
  totalAllocated,
  totalSpent,
  remaining,
  percentSpent,
  budgetType = "spending",
}: {
  totalAllocated: number;
  totalSpent: number;
  remaining: number;
  percentSpent: number;
  budgetType?: BudgetType;
}) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting;

  const isSavings = budgetType === "savings";
  // A savings goal is never over budget; reaching it is the goal.
  const isOverBudget = !isSavings && totalSpent > totalAllocated;

  // Currency preferences are presentation-only. Format unchanged budget totals.
  const targetCurrency = (settings?.currency ||
    "EUR") as import("@presentation/utils/currencyService").Currency;
  const formattedAllocated = currencyService.formatCurrency(
    totalAllocated,
    targetCurrency,
    false,
  );

  const formattedSpent = currencyService.formatCurrency(
    totalSpent,
    targetCurrency,
    false,
  ); // Remaining may be negative when over budget; format its magnitude
  // and apply the sign in the JSX below.
  const formattedRemaining = currencyService.formatCurrency(
    Math.abs(remaining),
    targetCurrency,
    false,
  );

  return (
    <OverBudgetContainer isOverBudget={isOverBudget}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <OverBudgetIcon isOverBudget={isOverBudget} size="sm" />
          <span className="font-medium">
            {isSavings ? t("budgets.totalGoal") : t("budgets.totalLimit")}
          </span>
        </div>
        <span className="text-lg font-bold">
          {formattedAllocated.formatted}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span>
          {isSavings
            ? t("budgets.hasSaved", { amount: formattedSpent.formatted })
            : t("budgets.hasSpent", { amount: formattedSpent.formatted })}
        </span>
        <span className="font-medium">
          {Math.round(Number.isFinite(percentSpent) ? percentSpent : 0)}%
        </span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className={`h-2 rounded-full ${
            isSavings
              ? "bg-green-500"
              : percentSpent > 90
              ? "bg-red-500"
              : percentSpent > 75
              ? "bg-yellow-500"
              : "bg-green-500"
          }`}
          style={{ width: `${Math.min(percentSpent, 100)}%` }}
        ></div>
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
    </OverBudgetContainer>
  );
}
