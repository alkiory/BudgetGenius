import { useDecimalInput } from "@adapters/hooks/useDecimalInput";
import { RootState } from "@adapters/store/rootStore";
import { BudgetCategory } from "@domain/dashboard/budgets/budget.entity";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import {
  Currency,
  CURRENCY_PRECISION_MAP,
  currencyService,
  toCurrency,
} from "@presentation/utils/currencyService";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

interface Props {
  category: BudgetCategory;
  onUpdateSpent: (categoryId: number, spent: number) => void;
  onDeleteCategory: (category: BudgetCategory) => void;
}

export const EditableBudgetCategory: React.FC<Props> = ({
  category,
  onUpdateSpent,
  onDeleteCategory,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);

  const userSetting = useSelector((state: RootState) => state.userSettings);
  const { settings } = userSetting;

  const targetCurrency = (settings?.currency || "USD") as Currency;

  const spentInput = useDecimalInput({
    initial: category.spent,
    currency: targetCurrency,
  });

  // "Add expense" semantics: clicking opens an empty input, the user
  // types a NEW expense amount in the display currency, and on save
  // we convert display → source and ADD to the existing
  // `category.spent`. This replaces the old "edit" (replace) flow
  // that was confused when source and display currencies differed
  // (the input used to be pre-filled with the raw USD-stored value
  // even when the user was viewing in EUR/COP, causing a visible
  // disconnect between what the user saw and what they were
  // overwriting). The component is mounted under a per-row `key`
  // (see `category-list.tsx`) so the hook re-reads `category.spent`
  // on remount, keeping the initial buffer in sync without needing
  // a `useEffect` (see `useDecimalInput` JSDoc — pushing a prop
  // back into the buffer would fight the controlled input and
  // create an infinite render loop).
  const handleAddExpenseClick = () => {
    setIsEditing(true);
    spentInput.setText("");
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    spentInput.setText("");
  };

  const handleSaveClick = () => {
    if (!category) return;
    const parsed = spentInput.parseNumber();
    // No-op + close for empty / NaN / non-positive input so the user
    // can "cancel" by clearing the field, and we never send a
    // no-op zero update that would still hit the network.
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setIsEditing(false);
      spentInput.setText("");
      return;
    }

    // Convert the entered amount (display currency) into the row's
    // source currency before adding to the stored spent. The
    // same-currency shortcut avoids the `amount / rate * rate`
    // floating-point noise that `convertAmount` would otherwise
    // introduce (e.g. `10 * 0.93 / 0.93` is not always exactly 10).
    const sourceCurrency = toCurrency(category.currency);
    const addedInSource =
      targetCurrency === sourceCurrency
        ? parsed
        : currencyService.convertAmount({
            amount: parsed,
            fromCurrency: targetCurrency,
            toCurrency: sourceCurrency,
          });

    // Round to the source currency's decimal precision so the SQL
    // `numeric` column doesn't persist floating-point garbage like
    // `15.010000000002`. COP (precision 0) collapses to a whole
    // number; USD/EUR (precision 2) keep two decimals.
    const precision = CURRENCY_PRECISION_MAP[sourceCurrency] ?? 2;
    const newSpent = Number(
      ((category.spent || 0) + addedInSource).toFixed(precision),
    );

    onUpdateSpent(category.id as number, newSpent);
    setIsEditing(false);
    spentInput.setText("");
  };

  // Backend stores each category's `spent` in its own `currency` column
  // (added in migration 1800000000004 with default 'USD'; new rows can
  // be EUR/COP, so we MUST take the source from the row, not from a
  // global constant). Convert from the row's currency → user's target
  // currency, then render the locale-aware `.formatted` string (NOT
  // `.amount`, which is the raw converted number). The previous version
  // passed `targetCurrency, targetCurrency` — source == target — which
  // `.convertAmount` short-circuits as a no-op, so COP users saw a
  // USD-stored number rendered with no thousands separator and a
  // hardcoded USD-style 2-decimal default.
  // `toCurrency` validates the row's currency code at runtime so the
  // formatter never receives garbage (see currencyService.ts).
  const sourceCurrency = toCurrency(category.currency);
  const formattedSpent = currencyService.formatCurrency(
    category.spent,
    sourceCurrency,
    targetCurrency,
    false,
  );

  return (
    <div className="mt-3 flex items-center justify-between">
      <div className="flex-1">
        <Label htmlFor={`category-spent-${category.id}`} className="text-xs">
          {isEditing ? t("budgets.addExpense") : t("budgets.spent")}
        </Label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            {formattedSpent.symbol}
          </span>
          {isEditing ? (
            <Input
              id={`category-spent-${category.id}`}
              type="text"
              inputMode="decimal"
              step={
                spentInput.precision === 0 ? 1 : 1 / 10 ** spentInput.precision
              }
              value={spentInput.text}
              onChange={(e) => spentInput.setText(e.target.value)}
              placeholder="0"
              aria-label={t("budgets.spentLabelAria", {
                category: category.name,
              })}
              className="pl-7"
            />
          ) : (
            <span className="pl-7">{formattedSpent.formatted}</span>
          )}
        </div>
        {isEditing && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t("budgets.addExpenseCurrent", {
              current: formattedSpent.formatted,
            })}
          </p>
        )}
      </div>
      <div className="flex items-center">
        {!isEditing ? (
          <Button
            variant="default"
            size="sm"
            className="ml-2"
            onClick={handleAddExpenseClick}
          >
            {t("budgets.addExpense")}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={handleSaveClick}
            >
              {t("common.save")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-2"
              onClick={handleCancelClick}
            >
              {t("common.cancel")}
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteCategory(category);
          }}
        >
          {t("common.delete")}
        </Button>
      </div>
    </div>
  );
};
