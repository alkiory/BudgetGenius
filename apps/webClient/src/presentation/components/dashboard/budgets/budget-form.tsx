import { RootState } from "@adapters/store/rootStore";
import {
  Budget,
  BudgetCategory,
  PERIOD_OPTIONS,
} from "@domain/dashboard/budgets/budget.entity";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { BudgetCategoryRow } from "./budget-category-row";

interface BudgetFormProps {
  budget?: Budget;
  onSubmit: (budget: Partial<Budget>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function BudgetForm({ budget, onSubmit, onCancel }: BudgetFormProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const targetCurrency = (userSetting?.settings?.currency || "USD") as Currency;
  const currencySymbol = currencyService.getSymbol(targetCurrency);

  const [formData, setFormData] = useState<Partial<Budget>>({
    name: "",
    period: "Monthly",
    startDate: new Date(new Date().setMonth(new Date().getMonth())),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    totalAllocated: 0,
    totalSpent: 0,
  });

  const [categories, setCategories] = useState<BudgetCategory[]>([]);

  // Totals reducer — now safe with numeric `allocated` / `spent`
  // because `BudgetCategoryRow` calls `onCategoryChange` with the
  // parsed number (or 0 for empty / invalid). The pre-refactor
  // `type="number"` path stored strings in some cases (the
  // #stuck-at-zero fix widened the buffer to `string | number`),
  // which would have caused `sum + "100"` to concatenate and the
  // totals display to render `NaN.toFixed(2)`.
  const totalAllocated = categories.reduce(
    (sum, category) => sum + (Number(category.allocated) || 0),
    0,
  );
  const totalSpent = categories.reduce(
    (sum, category) => sum + (Number(category.spent) || 0),
    0,
  );

  useEffect(() => {
    if (budget) {
      setFormData({
        ...budget,
        startDate: new Date(budget.startDate),
        endDate: new Date(budget.endDate),
      });
      setCategories(budget.categories);
    } else {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFormData({
        name: "Monthly Budget",
        period: PERIOD_OPTIONS[0],
        startDate: firstDay,
        endDate: lastDay,
        totalAllocated: 0,
        totalSpent: 0,
      });
      // Bug fix (#NaN-total): initialize amounts to 0 (not `undefined`)
      // so the totals reducer above never produces NaN. The text input
      // still renders "0" via `useDecimalInput`'s `initial: 0` mapping.
      setCategories([
        {
          budgetId: 0,
          name: "",
          allocated: 0,
          spent: 0,
        },
      ]);
    }
  }, [budget]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategoryInputChange = (
    index: number,
    field: keyof BudgetCategory,
    value: string | number,
  ) => {
    setCategories((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value } as BudgetCategory;
      return updated;
    });
  };

  const addCategory = () => {
    setCategories((prev) => [
      ...prev,
      {
        budgetId: budget?.id ?? 0,
        name: "",
        allocated: 0,
        spent: 0,
      },
    ]);
  };

  const removeCategory = (index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Bug fix (#currency-edit-mangling): previously each amount was
    // converted from the user's display currency to USD via
    // `currencyService.normalizeAmount`, which means a user entering
    // 2000 EUR would store ~2150 USD — and on edit, the form would
    // re-display 2150 with the user's currency symbol glued back on.
    // Round-trip was only preserved when exchange rates did not
    // shift between sessions. Now amounts are persisted as the user
    // entered them in their configured currency; display reads (in
    // `EditableBudgetCategory` and the BudgetSummary) already treat
    // the value as a no-op identity conversion (source =
    // targetCurrency).
    //
    // Belt-and-suspenders coercion: `BudgetCategoryRow` already
    // stores parsed numbers via `onCategoryChange`, so
    // `Number(...) || 0` here is a no-op in the happy path. It
    // remains as a safety net for the `name`-only edit path (where
    // the row sends a string and we never touch `allocated` /
    // `spent`) and for any future caller that bypasses the row.
    const normalizedCategories = categories.map((cat) => ({
      ...cat,
      allocated: Number(cat.allocated) || 0,
      spent: Number(cat.spent) || 0,
    }));
    onSubmit({ ...formData, categories: normalizedCategories });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 overflow-y-auto max-h-[80vh]"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t("budgets.budgetName")}</Label>

          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder={t("budgets.namePlaceholder")}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="period">{t("budgets.budgetPeriod")}</Label>

          <select
            id="period"
            name="period"
            value={formData.period}
            onChange={handleChange}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            required
          >
            {PERIOD_OPTIONS.map((period) => (
              <option key={period} value={period}>
                {t(
                  `periods.${
                    period === "Bi-weekly"
                      ? "biWeekly"
                      : period === "One-time"
                      ? "oneTime"
                      : period.toLowerCase()
                  }`,
                )}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">{t("budgets.startDate")}</Label>

            <Input
              id="startDate"
              name="startDate"
              type="date"
              value={
                formData.startDate instanceof Date
                  ? formData.startDate.toISOString().split("T")[0]
                  : formData.startDate
              }
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">{t("budgets.endDate")}</Label>

            <Input
              id="endDate"
              name="endDate"
              type="date"
              value={
                formData.endDate instanceof Date
                  ? formData.endDate.toISOString().split("T")[0]
                  : formData.endDate
              }
              onChange={handleChange}
              required
            />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">
            {t("budgets.budgetCategories")}
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCategory}
            disabled={!!budget}
          >
            {t("budgets.addCategory")}
          </Button>
        </div>

        <div className="space-y-4">
          {categories.map((category, index) => (
            <BudgetCategoryRow
              key={index}
              category={category}
              index={index}
              onCategoryChange={handleCategoryInputChange}
              onRemove={removeCategory}
            />
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-medium">{t("budgets.totalBudget")}</span>
            <span className="text-lg font-bold">
              {currencySymbol}
              {(totalAllocated - totalSpent).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit">
          {budget ? t("budgets.submitUpdate") : t("budgets.submitCreate")}
        </Button>
      </div>
    </form>
  );
}
