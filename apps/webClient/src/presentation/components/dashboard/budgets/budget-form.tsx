import { RootState } from "@adapters/store/rootStore";
import {
  Budget,
  BudgetCategory,
  BudgetType,
  PERIOD_OPTIONS,
  periodTranslationKey,
} from "@domain/dashboard/budgets/budget.entity";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { PiggyBank, Wallet } from "lucide-react";
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
  const targetCurrency = (userSetting?.settings?.currency || "EUR") as Currency;

  const [formData, setFormData] = useState<Partial<Budget>>({
    name: "",
    period: "Monthly",
    type: "spending",
    startDate: new Date(new Date().setMonth(new Date().getMonth())),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    totalAllocated: 0,
  });

  const [categories, setCategories] = useState<BudgetCategory[]>([]);

  const isSavings = formData.type === "savings";
  const amountLabel = isSavings
    ? t("budgets.goalLabel")
    : t("budgets.limitLabel");
  const totalLabel = isSavings
    ? t("budgets.totalGoal")
    : t("budgets.totalLimit");
  const addAmountLabel = isSavings
    ? t("budgets.addSavingsCategory")
    : t("budgets.addSpendingCategory");

  // Totals reducer — safe with numeric `allocated` because
  // `BudgetCategoryRow` bubbles the parsed number (or 0 for empty).
  const totalAllocated = categories.reduce(
    (sum, category) => sum + (Number(category.allocated) || 0),
    0,
  );
  const formattedTotal = currencyService.formatCurrency(
    totalAllocated,
    targetCurrency,
    false,
  ).formatted;

  useEffect(() => {
    if (budget) {
      setFormData({
        ...budget,
        type: budget.type ?? "spending",
        startDate: new Date(budget.startDate),
        endDate: new Date(budget.endDate),
      });
      setCategories(budget.categories);
    } else {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFormData({
        name: "",
        period: "Monthly",
        type: "spending",
        startDate: firstDay,
        endDate: lastDay,
        totalAllocated: 0,
      });
      setCategories([
        {
          budgetId: 0,
          name: "",
          allocated: 0,
          spent: 0,
          manualSpent: 0,
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

  const handleTypeChange = (type: BudgetType) => {
    setFormData((prev) => ({ ...prev, type }));
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
        manualSpent: 0,
      },
    ]);
  };

  const removeCategory = (index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Amounts are stored exactly as entered in the user's currency. The
    // effective `spent` is computed by the API (manual baseline plus
    // linked transactions), so the form never submits a spent value.
    const normalizedCategories = categories.map((cat) => ({
      ...cat,
      allocated: Number(cat.allocated) || 0,
      manualSpent: Number(cat.manualSpent ?? 0) || 0,
    }));
    onSubmit({
      ...formData,
      totalAllocated: normalizedCategories.reduce(
        (sum, category) => sum + category.allocated,
        0,
      ),
      categories: normalizedCategories,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-h-[80vh] space-y-6 overflow-y-auto pr-1"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t("budgets.budgetType")}</Label>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
            <button
              type="button"
              data-testid="budget-type-spending"
              onClick={() => handleTypeChange("spending")}
              aria-pressed={!isSavings}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                !isSavings
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              <Wallet className="h-4 w-4" />
              {t("budgets.typeSpending")}
            </button>
            <button
              type="button"
              data-testid="budget-type-savings"
              onClick={() => handleTypeChange("savings")}
              aria-pressed={isSavings}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isSavings
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              <PiggyBank className="h-4 w-4" />
              {t("budgets.typeSavings")}
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isSavings
              ? t("budgets.savingsTypeHint")
              : t("budgets.spendingTypeHint")}
          </p>
        </div>

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
                {t(`periods.${periodTranslationKey(period)}`)}
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
          <div>
            <h3 className="text-lg font-medium">
              {t("budgets.budgetCategories")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("budgets.categoryHelp")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCategory}
            disabled={!!budget}
          >
            {addAmountLabel}
          </Button>
        </div>

        <div className="space-y-4">
          {categories.map((category, index) => (
            <BudgetCategoryRow
              key={index}
              category={category}
              index={index}
              amountLabel={amountLabel}
              onCategoryChange={handleCategoryInputChange}
              onRemove={removeCategory}
            />
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-medium">{totalLabel}</span>
            <span className="text-lg font-bold">{formattedTotal}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isSavings
              ? t("budgets.savingsTotalHint")
              : t("budgets.spendingTotalHint")}
          </p>
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
