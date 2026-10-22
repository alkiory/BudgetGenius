import { RootState } from "@adapters/store/rootStore";
import {
  BudgetCategory,
  BudgetType,
} from "@domain/dashboard/budgets/budget.entity";
import {
  OverBudgetContainer,
  OverBudgetIcon,
  OverBudgetBadge,
} from "@presentation/components/ui/budget-status";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { EditableBudgetCategory } from "./budget-category";

export default function BudgetCategoryList({
  categoryBudgets,
  budgetType,
  onAddManualAmount,
  onDeleteCategoryHandler,
}: {
  categoryBudgets: BudgetCategory[];
  budgetType: BudgetType;
  onAddManualAmount: (categoryId: number, amount: number) => void;
  onDeleteCategoryHandler: (category: BudgetCategory) => void;
}) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting;
  const isSavings = budgetType === "savings";

  return (
    <div className="space-y-2">
      {categoryBudgets?.map((category) => {
        const percentUsed =
          category.allocated > 0
            ? (category.spent / category.allocated) * 100
            : 0;
        const remaining = category.allocated - category.spent;

        // A savings goal is never "over budget": exceeding it is success,
        // so only spending categories use the red over-budget treatment.
        const isOverBudget = !isSavings && percentUsed > 100;
        const progressColor = isSavings
          ? "bg-green-500"
          : percentUsed > 100
          ? "bg-red-500"
          : percentUsed > 90
          ? "bg-yellow-500"
          : "bg-green-500";

        const targetCurrency = (settings?.currency || "EUR") as Currency;

        const formattedRemaining = currencyService.formatCurrency(
          Math.abs(remaining),
          targetCurrency,
          false,
        );

        const formattedAllocated = currencyService.formatCurrency(
          category.allocated,
          targetCurrency,
          false,
        );

        const formattedSpent = currencyService.formatCurrency(
          category.spent,
          targetCurrency,
          false,
        );

        const progressText = isSavings
          ? t("budgets.savedOfGoal", {
              saved: formattedSpent.formatted,
              goal: formattedAllocated.formatted,
            })
          : t("budgets.spentOfAllocated", {
              spent: formattedSpent.formatted,
              allocated: formattedAllocated.formatted,
            });

        const remainingText =
          remaining >= 0
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
              });

        return (
          <OverBudgetContainer key={category.id} isOverBudget={isOverBudget}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <OverBudgetIcon isOverBudget={isOverBudget} size="sm" />
                <h4 className="font-medium">
                  {t(`categories.${category.name.toLowerCase()}`, {
                    defaultValue: category.name,
                  })}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <OverBudgetBadge
                  isOverBudget={isOverBudget}
                  text={t("reports.overByPercent", {
                    percent: Math.round(percentUsed - 100),
                  })}
                />
                <span className="text-sm font-medium">
                  {Math.round(percentUsed)}%
                </span>
              </div>
            </div>

            <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className={`h-2 rounded-full ${progressColor}`}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              ></div>
            </div>

            <div className="mt-2 flex items-center justify-between text-sm">
              <span>{progressText}</span>
              <span
                className={
                  remaining >= 0 || isSavings
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }
              >
                {remainingText}
              </span>
            </div>

            <EditableBudgetCategory
              category={category}
              budgetType={budgetType}
              onAddManualAmount={onAddManualAmount}
              onDeleteCategory={onDeleteCategoryHandler}
            />
          </OverBudgetContainer>
        );
      })}
    </div>
  );
}
