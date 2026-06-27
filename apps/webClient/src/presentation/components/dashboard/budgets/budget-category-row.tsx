import { useDecimalInput } from "@adapters/hooks/useDecimalInput";
import { RootState } from "@adapters/store/rootStore";
import { BudgetCategory } from "@domain/dashboard/budgets/budget.entity";
import { TRANSACTION_CATEGORIES } from "@domain/dashboard/transactions/transaction.entity";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { Currency } from "@presentation/utils/currencyService";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

/**
 * `step` attribute for `<input type="text" inputMode="decimal">`,
 * derived from the active currency's decimal precision. Pure
 * function — hoisted to module scope so it isn't re-created on
 * every render. Same shape as the local `stepAttr` in
 * `add-budget-category.tsx`.
 */
const stepFromPrecision = (precision: number): number =>
  precision === 0 ? 1 : 1 / 10 ** precision;

interface BudgetCategoryRowProps {
  /** Current category entity from the parent form state. */
  category: BudgetCategory;
  /** Stable row index — used for `id`/`htmlFor` wiring and as React key. */
  index: number;
  /**
   * Bubble a change up to the parent. The parent stores the parsed
   * numeric value for `allocated` / `spent` and the raw string for
   * `name`. `value` is typed as `string | number` because `name` is
   * a string and the amounts are numbers — matches the parent's
   * `handleCategoryInputChange` signature in `BudgetForm`.
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
 * Single editable row for a Budget category inside `BudgetForm`.
 *
 * Migrated from the legacy `type="number"` input pattern to
 * `type="text" inputMode="decimal"` backed by the shared
 * `useDecimalInput` hook. Benefits:
 *
 * 1. **Locale-aware decimal handling** — the `step` attribute and
 *    `inputMode` follow the active currency (COP → 0 decimals,
 *    USD/EUR → 2 decimals), matching `add-budget-category.tsx` and
 *    `EditableBudgetCategory` so the budgets feature is consistent.
 * 2. **Safari silent-keystroke-drop fix** — Safari's `type="number"`
 *    silently drops keystrokes that don't form a valid number
 *    (e.g. the user is mid-typing "1.5" and the "." is dropped).
 *    `type="text" inputMode="decimal"` avoids this entirely.
 * 3. **Unified pattern** — same hook, same input config, same
 *    `parseNumber()` boundary across all three budgets surfaces.
 *
 * The hook's `text` buffer is the source of truth for the
 * in-flight edit; the parent receives the *parsed* numeric value
 * (or 0 for empty / invalid) via `onCategoryChange` so the totals
 * reducer in `BudgetForm` stays NaN-safe without needing a
 * `Number(value) || 0` coercion on every keystroke.
 */
export function BudgetCategoryRow({
  category,
  index,
  onCategoryChange,
  onRemove,
}: BudgetCategoryRowProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const targetCurrency = (userSetting?.settings?.currency || "USD") as Currency;

  // Two independent `useDecimalInput` instances — each owns its own
  // text buffer. This mirrors the `add-budget-category.tsx` pattern
  // and keeps the hook's contract simple (one field per instance).
  //
  // See `useDecimalInput` JSDoc for the "initial is read once" /
  // "do not useEffect-resync" constraint — this consumer-level
  // comment is just a pointer to the canonical warning.
  const allocatedInput = useDecimalInput({
    initial: category.allocated,
    currency: targetCurrency,
  });
  const spentInput = useDecimalInput({
    initial: category.spent,
    currency: targetCurrency,
  });

  // On every keystroke: (1) update the hook's text buffer so the
  // controlled input re-renders with the new value, (2) parse and
  // bubble the numeric value to the parent so the form's totals
  // reducer stays in sync. `Number.isFinite` guard prevents NaN
  // from leaking into the parent (empty / partial-decimal input
  // parses to NaN, which the parent would otherwise stringify in
  // the totals reduce).
  const handleAllocatedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    allocatedInput.setText(text);
    const parsed = allocatedInput.parseNumber();
    onCategoryChange(
      index,
      "allocated",
      Number.isFinite(parsed) ? parsed : 0,
    );
  };

  const handleSpentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    spentInput.setText(text);
    const parsed = spentInput.parseNumber();
    onCategoryChange(index, "spent", Number.isFinite(parsed) ? parsed : 0);
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 space-y-2">
        <Label htmlFor={`category-name-${index}`}>
          {t("budgets.categoryName")}
        </Label>
        <select
          id={`category-name-${index}`}
          value={category.name}
          onChange={(e) => onCategoryChange(index, "name", e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          required
        >
          {TRANSACTION_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {t(`categories.${cat.toLowerCase()}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 space-y-2">
        <Label htmlFor={`category-allocated-${index}`}>
          {t("budgets.allocatedAmount")}
        </Label>
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
            aria-label={t("budgets.allocatedAmount")}
            className="pl-7"
            required
          />
        </div>
      </div>
      <div className="flex-1 space-y-2">
        <Label htmlFor={`category-spent-${index}`}>
          {t("budgets.spentAmount")}
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            {spentInput.symbol}
          </span>
          <Input
            id={`category-spent-${index}`}
            type="text"
            inputMode="decimal"
            step={stepFromPrecision(spentInput.precision)}
            value={spentInput.text}
            onChange={handleSpentChange}
            aria-label={t("budgets.spentAmount")}
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
        className="mb-0.5 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
