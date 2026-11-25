import { useDecimalInput } from "@adapters/hooks/useDecimalInput";
import { RootState } from "@adapters/store/rootStore";
import {
  BUDGET_CATEGORY_OPTIONS,
  BudgetCategory,
} from "@domain/dashboard/budgets/budget.entity";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { Select } from "@presentation/components/ui/select";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { Trash2 } from "@presentation/components/ui/animated-icons";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

/**
 * `step` attribute for `<input type="text" inputMode="decimal">`,
 * derived from the active currency's decimal precision. Pure
 * function — hoisted to module scope so it isn't re-created on
 * every render.
 */
const stepFromPrecision = (precision: number): number =>
  precision === 0 ? 1 : 1 / 10 ** precision;

interface BudgetCategoryRowProps {
  /** Current category entity from the parent form state. */
  category: BudgetCategory;
  /** Stable row index — used for `id`/`htmlFor` wiring and as React key. */
  index: number;
  /** "Límite" for spending budgets, "Objetivo" for savings budgets. */
  amountLabel: string;
  /**
   * Bubble a change up to the parent. `value` is typed as
   * `string | number` because `name` is a string and `allocated` is a
   * number — matches the parent's `handleCategoryInputChange` signature.
   */
  onCategoryChange: (
    index: number,
    field: keyof BudgetCategory,
    value: string | number,
  ) => void;
  /** Remove this row from the parent's categories array. */
  onRemove: (index: number) => void;
}

/**
 * Single planning row for a Budget category: [category] [limit/goal]
 * [delete]. The spent amount is intentionally absent — it is computed by
 * the API from linked transactions (spending) or tracked manually from
 * the budget detail (savings).
 */
export function BudgetCategoryRow({
  category,
  index,
  amountLabel,
  onCategoryChange,
  onRemove,
}: BudgetCategoryRowProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const targetCurrency = (userSetting?.settings?.currency || "EUR") as Currency;

  const allocatedInput = useDecimalInput({
    initial: category.allocated,
    currency: targetCurrency,
  });

  const handleAllocatedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    allocatedInput.setText(text);
    // Parse the event value directly: `allocatedInput.parseNumber()` closes
    // over the pre-update text state, so it would report the previous
    // keystroke (and the parent totals would stay at 0).
    const parsed = currencyService.parseAmountInput(text);
    onCategoryChange(index, "allocated", Number.isFinite(parsed) ? parsed : 0);
  };

  return (
    <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-2">
        <Label htmlFor={`category-name-${index}`}>
          {t("budgets.categoryField")}
        </Label>
        <Select
          id={`category-name-${index}`}
          value={category.name}
          onChange={(value) => onCategoryChange(index, "name", value)}
          placeholder={t("transactions.selectCategory")}
          options={[
            { value: "", label: t("transactions.selectCategory") },
            // Keep a legacy category selectable even if it is not in the
            // curated planning list (e.g. an old "Salary" row).
            ...(category.name &&
            !BUDGET_CATEGORY_OPTIONS.includes(category.name)
              ? [
                  {
                    value: category.name,
                    label: t(`categories.${category.name.toLowerCase()}`, {
                      defaultValue: category.name,
                    }),
                  },
                ]
              : []),
            ...BUDGET_CATEGORY_OPTIONS.map((cat) => ({
              value: cat,
              label: t(`categories.${cat.toLowerCase()}`),
            })),
          ]}
        />
      </div>
      <div className="min-w-0 space-y-2">
        <Label htmlFor={`category-allocated-${index}`}>{amountLabel}</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            {allocatedInput.symbol}
          </span>
          <Input
            id={`category-allocated-${index}`}
            type="text"
            inputMode="decimal"
            step={stepFromPrecision(allocatedInput.precision)}
            value={allocatedInput.text}
            onChange={handleAllocatedChange}
            aria-label={amountLabel}
            className="pl-7"
            required
          />
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onRemove(index)}
        aria-label={t("budgets.removeCategory")}
        className="mb-0.5 justify-self-end text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
