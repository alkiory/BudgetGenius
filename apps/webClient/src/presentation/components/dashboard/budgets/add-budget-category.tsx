import { useTranslation } from 'react-i18next';
import { TRANSACTION_CATEGORIES } from "@domain/dashboard/transactions/transaction.entity";
import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";

export default function AddBudgetCategory({
  name,
  allocated,
  spent,
  handleNewCategoryChange,
  handleAddCategorySubmit
}: {
  name: string
  allocated: string
  spent: string
  handleNewCategoryChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  handleAddCategorySubmit: () => void
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-2">
          <Label htmlFor="new-category-name">{t('budgets.categoryName')}</Label>
          <select
            id={`category-name-${name}`}
            name="name"
            value={name}
            onChange={handleNewCategoryChange}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            required
          >
            <option value="">{t('transactions.selectCategory')}</option>
            {TRANSACTION_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`categories.${category.toLowerCase()}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 space-y-2">
          <Label htmlFor="new-category-allocated">{t('budgets.allocatedAmount')}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
            <Input
              id="new-category-allocated"
              type="number"
              name="allocated"
              min="0"
              step="0.01"
              value={allocated}
              onChange={handleNewCategoryChange}
              className="pl-7"
              required
            />
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <Label htmlFor="new-category-spent">{t('budgets.spentAmount')}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
            <Input
              id="new-category-spent"
              type="number"
              name="spent"
              min="0"
              step="0.01"
              value={spent}
              onChange={handleNewCategoryChange}
              className="pl-7"
              required
            />
          </div>
        </div>
        <Button onClick={handleAddCategorySubmit}>{t('common.add')}</Button>
      </div>
    </div>
  )
}
