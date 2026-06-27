import { RootState } from "@adapters/store/rootStore";
import { BudgetCategory } from "@domain/dashboard/budgets/budget.entity";
import {
  OverBudgetContainer,
  OverBudgetIcon,
  OverBudgetBadge,
} from "@presentation/components/ui/budget-status";
import {
  Currency,
  currencyService,
  toCurrency,
} from "@presentation/utils/currencyService";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { EditableBudgetCategory } from "./budget-category";

export default function BudgetCategoryList({
  categoryBudgets,
  onUpdateSpent,
  onDeleteCategoryHandler,
}: {
  categoryBudgets: BudgetCategory[];
  onUpdateSpent: (categoryId: number, spent: number) => void;
  onDeleteCategoryHandler: (category: BudgetCategory) => void;
}) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting;

  return (
    <div className="space-y-2">
      {categoryBudgets?.map((category) => {
        const percentUsed =
          category.allocated > 0
            ? (category.spent / category.allocated) * 100
            : 0;
        const remaining = category.allocated - category.spent;

        const progressColor =
          percentUsed > 100
            ? "bg-red-500"
            : percentUsed > 90
            ? "bg-yellow-500"
            : "bg-green-500";

        const targetCurrency = (settings?.currency || "USD") as Currency;
        // Source currency of `remaining`/`allocated`/`spent` is the
        // category's own `currency` column (default 'USD' via the
        // api migration 1800000000004). Reading from `category.currency`
        // makes the display correct even for newly-created categories
        // that picked EUR/COP at creation time. `toCurrency` validates
        // the value at runtime so the formatter never receives garbage.
        const sourceCurrency = toCurrency(category.currency);

        // `remaining` can be negative (over budget). Pass
        // `Math.abs(remaining)` and `showSign: false` so the
        // formatted string is always the magnitude (`$50.00`), and
        // apply the sign in the JSX below (`-$50.00 over budget`
        // for negatives, `$50.00 remaining` for positives). Same
        // pattern as `budget-summary.tsx` and `budget-list.tsx` —
        // avoids the `formatCurrency(showSign: true)` + manual
        // `stripLeadingPlus` hack and keeps the formatter behavior
        // consistent across the three budget views.
        const formattedRemaining = currencyService.formatCurrency(
          Math.abs(remaining),
          sourceCurrency,
          targetCurrency,
          false,
        );

        const formattedAllocated = currencyService.formatCurrency(
          category.allocated,
          sourceCurrency,
          targetCurrency,
          false,
        );

        const formattedSpent = currencyService.formatCurrency(
          category.spent,
          sourceCurrency,
          targetCurrency,
          false,
        );

        const isOverBudget = percentUsed > 100;

        return (
          <OverBudgetContainer key={category.id} isOverBudget={isOverBudget}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <OverBudgetIcon isOverBudget={isOverBudget} size="sm" />
                <h4 className="font-medium">{category.name}</h4>
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
              <span>
                {t("budgets.spentOfAllocated", {
                  spent: formattedSpent.formatted,
                  allocated: formattedAllocated.formatted,
                })}
              </span>
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

            <EditableBudgetCategory
              category={category}
              onUpdateSpent={onUpdateSpent}
              onDeleteCategory={onDeleteCategoryHandler}
            />
          </OverBudgetContainer>
        );
      })}
    </div>
  );
}
