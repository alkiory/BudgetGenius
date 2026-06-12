import { BudgetCategory } from "@domain/dashboard/budgets/budget.entity";
import { EditableBudgetCategory } from "./budget-category";
import { useSelector } from "react-redux";
import { RootState } from "@adapters/store/rootStore";
import { Currency, currencyService } from "@presentation/utils/currencyService";

export default function BudgetCategoryList({
  categoryBudgets,
  onUpdateSpent,
  onDeleteCategoryHandler }:
  {
    categoryBudgets: BudgetCategory[],
    onUpdateSpent: (categoryId: number, spent: number) => void,
    onDeleteCategoryHandler: (category: BudgetCategory) => void
  }) {
  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting

  return (
    <div className="space-y-2">
      {categoryBudgets?.map((category) => {
        const percentUsed = category.allocated > 0 ? (category.spent / category.allocated) * 100 : 0;
        const remaining = category.allocated - category.spent;

        const progressColor =
          percentUsed > 100 ? "bg-red-500" : percentUsed > 90 ? "bg-yellow-500" : "bg-green-500";

        const targetCurrency = (settings?.currency || 'USD') as Currency;
        const formattedRemaining = currencyService.formatCurrency(
          remaining,
          targetCurrency as Currency,
          targetCurrency,
          false
        );

        const formattedAllocated = currencyService.formatCurrency(
          category.allocated,
          targetCurrency as Currency,
          targetCurrency,
          false
        )

        const formattedSpent = currencyService.formatCurrency(
          category.spent,
          targetCurrency as Currency,
          targetCurrency,
          false
        )

        return (
          <div key={category.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{category.name}</h4>
              <span className="text-sm font-medium">{Math.round(percentUsed)}%</span>
            </div>

            <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
              <div className={`h-2 rounded-full ${progressColor}`} style={{ width: `${Math.min(percentUsed, 100)}%` }}></div>
            </div>

            <div className="mt-2 flex items-center justify-between text-sm">
              <span>
                {formattedSpent.formatted} of {formattedAllocated.formatted}
              </span>
              <span
                className={remaining >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
              >
                {remaining >= 0
                  ? `${formattedRemaining.formatted} remaining`
                  : `${Math.abs(formattedRemaining.amount).toFixed(2)} over budget`}
              </span>
            </div>

            <EditableBudgetCategory
              category={category}
              onUpdateSpent={onUpdateSpent}
              onDeleteCategory={onDeleteCategoryHandler}
            />
          </div>
        );
      })}
    </div>
  )
}