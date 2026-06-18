import { useTranslation } from 'react-i18next';
import { useSelector } from "react-redux";
import { RootState } from "@adapters/store/rootStore";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { useState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Budget, BudgetCategory, PERIOD_OPTIONS } from "@domain/dashboard/budgets/budget.entity";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { TRANSACTION_CATEGORIES } from "@domain/dashboard/transactions/transaction.entity";

interface BudgetFormProps {
  budget?: Budget;
  onSubmit: (budget: Partial<Budget>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

type CategoryInputRefs = {
  [key: string]: { // Key será `${index}-${fieldName}`
    current: HTMLInputElement | HTMLSelectElement | null;
  };
};

export function BudgetForm({ budget, onSubmit, onCancel }: BudgetFormProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const targetCurrency = (userSetting?.settings?.currency || 'USD') as Currency;
  const currencySymbol = currencyService.getSymbol(targetCurrency);

  const [formData, setFormData] = useState<Partial<Budget>>({
    name: "",
    period: "Monthly",
    startDate: new Date(new Date().setMonth(new Date().getMonth())),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    totalAllocated: 0,
    totalSpent: 0
  });

  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const categoryInputRefs = useRef<CategoryInputRefs>({});

  const totalAllocated = categories.reduce((sum, category) => sum + category.allocated, 0);
  const totalSpent = categories.reduce((sum, category) => sum + category.spent, 0);

  useEffect(() => {
    if (budget) {
      setFormData({ ...budget, startDate: new Date(budget.startDate), endDate: new Date(budget.endDate) });
      setCategories(budget.categories);
    } else {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFormData({ name: "Monthly Budget", period: PERIOD_OPTIONS[0], startDate: firstDay, endDate: lastDay, totalAllocated: 0, totalSpent: 0 });
      setCategories([{ budgetId: 0, name: "", allocated: undefined as unknown as number, spent: undefined as unknown as number }]);
    }
  }, [budget]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategoryInputChange = (index: number, field: keyof BudgetCategory, value: string | number) => {
    setCategories((prev) => {
      const updated = [...prev];
      const currentValue = typeof value === 'string' && (field === "allocated" || field === "spent")
        ? value === "" ? (undefined as unknown as number) : Number(value) || 0
        : value;
      updated[index] = { ...updated[index], [field]: currentValue };
      return updated;
    });
  };

  const addCategory = () => {
    setCategories((prev) => [...prev, { budgetId: budget?.id ?? 0, name: "", allocated: undefined as unknown as number, spent: undefined as unknown as number }]);
  };

  const removeCategory = (index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCategories = categories.map((cat) => ({
      ...cat,
      allocated: currencyService.normalizeAmount(Number(cat.allocated) || 0, targetCurrency),
      spent: currencyService.normalizeAmount(Number(cat.spent) || 0, targetCurrency),
    }));
    onSubmit({ ...formData, categories: normalizedCategories });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto max-h-[80vh]">
      <div className="space-y-4">

        <div className="space-y-2">

          <Label htmlFor="name">{t('budgets.budgetName')}</Label>

          <Input

            id="name"

            name="name"

            value={formData.name}

            onChange={handleChange}

            placeholder={t('budgets.namePlaceholder')}

            required

          />

        </div>



        <div className="space-y-2">

          <Label htmlFor="period">{t('budgets.budgetPeriod')}</Label>

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

                {t(`periods.${period === 'Bi-weekly' ? 'biWeekly' : period === 'One-time' ? 'oneTime' : period.toLowerCase()}`)}

              </option>

            ))}

          </select>

        </div>



        <div className="grid grid-cols-2 gap-4">

          <div className="space-y-2">

            <Label htmlFor="startDate">{t('budgets.startDate')}</Label>

            <Input

              id="startDate"

              name="startDate"

              type="date"

              value={formData.startDate instanceof Date ? formData.startDate.toISOString().split("T")[0] : formData.startDate}

              onChange={handleChange}

              required

            />

          </div>

          <div className="space-y-2">

            <Label htmlFor="endDate">{t('budgets.endDate')}</Label>

            <Input

              id="endDate"

              name="endDate"

              type="date"

              value={formData.endDate instanceof Date ? formData.endDate.toISOString().split("T")[0] : formData.endDate}

              onChange={handleChange} required />

          </div>

        </div>

      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">{t('budgets.budgetCategories')}</h3>
          <Button type="button" variant="outline" size="sm" onClick={addCategory} disabled={!!budget}>
            {t('budgets.addCategory')}
          </Button>
        </div>

        <div className="space-y-4">
          {categories.map((category, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor={`category-name-${index}`}>{t('budgets.categoryName')}</Label>
                <select
                  id={`category-name-${index}`}
                  value={category.name}
                  onChange={(e) => handleCategoryInputChange(index, "name", e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  ref={(el) => {
                    if (el) {
                      categoryInputRefs.current[`${index}-name`] = { current: el };
                    }
                  }}
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
                <Label htmlFor={`category-allocated-${index}`}>{t('budgets.allocatedAmount')}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{currencySymbol}</span>
                  <Input
                    id={`category-allocated-${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={category.allocated ?? ""}
                    onChange={(e) => handleCategoryInputChange(index, "allocated", e.target.value)}
                    className="pl-7"
                    ref={(el) => {
                      if (categoryInputRefs.current[`${index}-allocated`]) {
                        categoryInputRefs.current[`${index}-allocated`].current = el;
                      } else {
                        categoryInputRefs.current[`${index}-allocated`] = { current: el };
                      }
                    }}
                    required
                  />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor={`category-spent-${index}`}>{t('budgets.spentAmount')}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{currencySymbol}</span>
                  <Input
                    id={`category-spent-${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={category.spent ?? ""}
                    onChange={(e) => handleCategoryInputChange(index, "spent", e.target.value)}
                    className="pl-7"
                    ref={(el) => {
                      if (categoryInputRefs.current[`${index}-spent`]) {
                        categoryInputRefs.current[`${index}-spent`].current = el;
                      } else {
                        categoryInputRefs.current[`${index}-spent`] = { current: el };
                      }
                    }}
                    required
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeCategory(index)}
                className="mb-0.5 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-medium">{t('budgets.totalBudget')}</span>
            <span className="text-lg font-bold">{currencySymbol}{(totalAllocated - totalSpent).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit">{budget ? t('budgets.submitUpdate') : t('budgets.submitCreate')}</Button>
      </div>
    </form>
  );
}
