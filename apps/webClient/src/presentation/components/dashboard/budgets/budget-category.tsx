import { RootState } from "@adapters/store/rootStore";
import { useDecimalInput } from "@adapters/hooks/useDecimalInput";
import { BudgetCategory } from "@domain/dashboard/budgets/budget.entity";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { useState } from "react";
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
  const [isEditing, setIsEditing] = useState(false);

  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting;

  const targetCurrency = (settings?.currency || "USD") as Currency;

  // Wave 2 [T2.1]: locale-aware decimal input backed by the shared
  // `useDecimalInput` hook. Replaces the legacy `<Input type="number"
  // step="0.01">` which (a) ignored non-US decimal separators for COP
  // users, (b) collapsed intermediate states like `"1."` to `1`,
  // c) was hardcoded to 2-decimal precision even for COP (precision 0).
  // The buffer is re-seeded from `category.spent` on every edit session
  // start AND on cancel so the user sees the canonical parent value,
  // not a stale buffer from a previous edit cycle. The numeric value
  // round-trips to the parent via `parseNumber()` at save time.
  const spentInput = useDecimalInput({
    initial: category.spent,
    currency: targetCurrency,
  });

  const handleEditClick = () => {
    setIsEditing(true);
    // Re-seed the buffer from the canonical category.spent so concurrent
    // updates to the parent budget (e.g. another tab saving) are picked
    // up when the local user clicks Edit.
    spentInput.setText(
      Number.isFinite(category.spent) ? String(category.spent) : "",
    );
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    spentInput.setText(
      Number.isFinite(category.spent) ? String(category.spent) : "",
    );
  };

  const handleSaveClick = () => {
    if (!category) return;
    // Parse at submit time so intermediate keystroke states (`"1."`,
    // `"10,42"`) resolve to the right number. `parseNumber` returns
    // NaN for empty/invalid buffer and we coerce to 0 to match the
    // pre-Wave-2 fallback (`Number(value) || 0`).
    const parsed = spentInput.parseNumber();
    const numeric = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    onUpdateSpent(category.id as number, numeric);
    setIsEditing(false);
  };

  // Bug fix (#currency-edit-mangling): previously the source currency was
  // hardcoded to "USD" on the assumption that all amounts were normalized
  // to USD at write-time. After un-normalizing the writes so the value is
  // stored in the user's configured currency, the read path must read
  // from `targetCurrency` (i.e. a no-op identity conversion that just
  // formats the number in the user's locale).
  const formattedSpent = currencyService.formatCurrency(
    category.spent,
    targetCurrency,
    targetCurrency,
    false,
  );

  return (
    <div className="mt-3 flex items-center justify-between">
      <div className="flex-1">
        <Label htmlFor={`category-spent-${category.id}`} className="text-xs">
          {isEditing ? "Update Spent Amount" : "Spent"}
        </Label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            {formattedSpent.symbol}
          </span>
          {isEditing ? (
            <Input
              id={`category-spent-${category.id}`}
              // Locale-aware: hardcoded dot step ignored COP-precision and
              // Spanish-locale users. The precision parameter derives
              // from `CURRENCY_PRECISION_MAP[currency]` (2 for USD/EUR,
              // 1 for COP because 1/10^0 = 1 entire unit).
              type="text"
              inputMode="decimal"
              step={
                spentInput.precision === 0 ? 1 : 1 / 10 ** spentInput.precision
              }
              value={spentInput.text}
              onChange={(e) => spentInput.setText(e.target.value)}
              aria-label={`Spent amount for ${category.name}`}
              aria-describedby={
                Number.isFinite(spentInput.parseNumber())
                  ? undefined
                  : `category-spent-error-${category.id}`
              }
              className="pl-7"
            />
          ) : (
            <span className="pl-7">{formattedSpent.amount}</span>
          )}
        </div>
      </div>
      <div className="flex items-center">
        {!isEditing ? (
          <Button
            variant="default"
            size="sm"
            className="ml-2"
            onClick={handleEditClick}
          >
            Edit
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={handleSaveClick}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-2"
              onClick={handleCancelClick}
            >
              Cancel
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
          Delete
        </Button>
      </div>
    </div>
  );
};
