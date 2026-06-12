import { RootState } from "@adapters/store/rootStore";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { useSelector } from "react-redux";

export default function BudgetSummary({ totalAllocated, totalSpent, remaining, percentSpent }: {
  totalAllocated: number;
  totalSpent: number;
  remaining: number;
  percentSpent: number;
}) {
  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting

  const targetCurrency = (settings?.currency || 'USD') as Currency;
  const formattedAllocated = currencyService.formatCurrency(
    totalAllocated,
    targetCurrency as Currency,
    targetCurrency,
    false
  );

  const formattedSpent = currencyService.formatCurrency(
    totalSpent,
    targetCurrency as Currency,
    targetCurrency,
    false
  )

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <span className="font-medium">Total Budget</span>
        <span className="text-lg font-bold">${formattedAllocated.formatted}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span>
          {formattedSpent.formatted} spent of {formattedAllocated.formatted}
        </span>
        <span className="font-medium">{Math.round(percentSpent)}%</span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className={`h-2 rounded-full ${percentSpent > 90 ? "bg-red-500" : percentSpent > 75 ? "bg-yellow-500" : "bg-green-500"
            }`}
          style={{ width: `${Math.min(percentSpent, 100)}%` }}
        ></div>
      </div>
      <div className="mt-2 text-sm">
        <span className={remaining >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
          {remaining >= 0 ? `$${remaining.toFixed(2)} remaining` : `$${Math.abs(remaining).toFixed(2)} over budget`}
        </span>
      </div>
    </div>
  )
}