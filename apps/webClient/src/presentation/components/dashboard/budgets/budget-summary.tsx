import { RootState } from "@adapters/store/rootStore";
import {
  OverBudgetContainer,
  OverBudgetIcon,
} from "@presentation/components/ui/budget-status";
import {
  currencyService,
  toCurrency,
} from "@presentation/utils/currencyService";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

export default function BudgetSummary({
  totalAllocated,
  totalSpent,
  remaining,
  percentSpent,
}: {
  totalAllocated: number;
  totalSpent: number;
  remaining: number;
  percentSpent: number;
}) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting;

  const isOverBudget = totalSpent > totalAllocated;

  // The api `Budget` entity has no `currency` column (only the child
  // `BudgetCategory` table got one in migration 1800000000004). The
  // totals returned from the backend are USD-normalized at the source —
  // the same convention category-list.tsx uses — so convert from USD to
  // the user's current target currency. `toCurrency(...)` keeps the
  // settings-read path type-safe even if the user's setting is
  // ever-shaped as an unknown value (legacy migration, future currency
  // additions, etc.).
  const targetCurrency = toCurrency(settings?.currency);
  // Literal "USD" (not via `toCurrency`) — `toCurrency` validates
  // externally-sourced strings, but this is a typed-constant from the
  // compile-time `Currency` union and TS narrows "USD" → assignable to
  // any `Currency` parameter slot, so the validation is unnecessary
  // indirection. The api `Budget` entity's lack of a `currency` column
  // is documented as a known assumption in the comment block above the
  // first `formatCurrency` call.
  const sourceCurrency = "USD";
  const formattedAllocated = currencyService.formatCurrency(
    totalAllocated,
    sourceCurrency,
    targetCurrency,
    false,
  );

  const formattedSpent = currencyService.formatCurrency(
    totalSpent,
    sourceCurrency,
    targetCurrency,
    false,
  ); // The prop `remaining = totalAllocated − totalSpent` is derived in
  // budget-detail.tsx; both operands are USD-normalized, so the result
  // is too. Format it through `formatCurrency` (NOT `toFixed(2)`) so
  // COP users see "0 $ " with the locale's 0-decimal precision instead
  // of "$0.00" — the latter was an explicit complaint in the user's
  // bug report for the parallel category-list bug. `remaining` can be
  // negative (over budget); we pass `Math.abs(remaining)` and
  // `showSign: false` so the formatted string is always the magnitude
  // (`$50.00`), and the sign is applied in the JSX below.
  const formattedRemaining = currencyService.formatCurrency(
    Math.abs(remaining),
    sourceCurrency,
    targetCurrency,
    false,
  );

  return (
    <OverBudgetContainer isOverBudget={isOverBudget}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <OverBudgetIcon isOverBudget={isOverBudget} size="sm" />
          <span className="font-medium">{t("budgets.totalLimit")}</span>
        </div>
        <span className="text-lg font-bold">
          {formattedAllocated.formatted}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span>
          {t("budgets.hasSpent", {
            amount: formattedSpent.formatted,
          })}
        </span>
        <span className="font-medium">
          {Math.round(Number.isFinite(percentSpent) ? percentSpent : 0)}%
        </span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className={`h-2 rounded-full ${
            percentSpent > 90
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
            ? t("budgets.availableAmount", {
                amount: formattedRemaining.formatted,
              })
            : t("budgets.amountOverBudget", {
                amount: `-${formattedRemaining.formatted}`,
              })}
        </span>
      </div>
    </OverBudgetContainer>
  );
}
