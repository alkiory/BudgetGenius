import { useTranslation } from 'react-i18next';
import { Income, INCOME_CATEGORIES, IncomeCategory, IncomeRecurrence } from "@domain/dashboard/incomes/income.entity"
import { Button } from "@presentation/components/ui/button"
import { Input } from "@presentation/components/ui/input"
import { Label } from "@presentation/components/ui/label"
import { useSelector } from "react-redux";
import { RootState } from "@adapters/store/rootStore";
import { Currency, currencyService } from "@presentation/utils/currencyService"
import { errorToast } from "@presentation/utils/toast"
import { useState, useEffect } from "react"

interface IncomeFormProps {
  income?: Income
  onSubmit: (income: Partial<Income>) => void
  onCancel: () => void
}

export function IncomeForm({ income, onSubmit, onCancel }: IncomeFormProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const targetCurrency = (userSetting?.settings?.currency || 'USD') as Currency;
  const currencySymbol = currencyService.getSymbol(targetCurrency);

  const [formData, setFormData] = useState({
    date: new Date(),
    category: "Other" as IncomeCategory,
    description: "",
    currency: targetCurrency,
    amount: undefined as unknown as number,
    recurrence: "One-time" as IncomeRecurrence,
  })

  // If editing an existing income, populate the form
  useEffect(() => {
    if (income) {
      setFormData({
        date: income.date,
        category: income.category,
        description: income.description,
        currency: income.currency as Currency,
        amount: Math.abs(income.amount),
        recurrence: income.recurrence || "One-time",
      })
    }
  }, [income])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const date = income ? income.date : new Date()

    const absAmount = Math.abs(formData.amount)
    if (Number.isNaN(absAmount) || absAmount === 0) {
      errorToast(t('income.amountCannotBeZero'), 3000, "invalid-amount")
      return
    }

    onSubmit({
      date,
      category: formData.category,
      description: formData.description,
      currency: formData.currency,
      amount: formData.amount,
      recurrence: formData.recurrence as IncomeRecurrence,
    })
  }

  const isEditing = !!income

  const recurrenceOptions: { value: IncomeRecurrence | 'Weekly' | 'Annually'; key: string }[] = [
    { value: 'One-time', key: 'income.recurrenceOneTime' },
    { value: 'Daily', key: 'income.recurrenceDaily' },
    { value: 'Weekly', key: 'income.recurrenceWeekly' },
    { value: 'Bi-weekly', key: 'income.recurrenceBiWeekly' },
    { value: 'Monthly', key: 'income.recurrenceMonthly' },
    { value: 'Quarterly', key: 'income.recurrenceQuarterly' },
    { value: 'Annually', key: 'income.recurrenceAnnually' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="category">{t('income.category')}</Label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          required
        >
          <option value="" disabled>
            {t('income.selectCategory')}
          </option>
          {INCOME_CATEGORIES.filter(category => category !== "All" && category !== "Todos").map((category) => (
            <option key={category} value={category}>
              {t(`incomeCategories.${category.toLowerCase()}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t('income.descriptionLabel')}</Label>
        <Input
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder={t('income.descriptionPlaceholder')}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">{t('income.amount')}</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{currencySymbol}</span>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            value={formData.amount ?? ""}
            onChange={(e) => {
              const { value } = e.target
              setFormData(prev => ({
                ...prev,
                amount: value === "" ? undefined as unknown as number : Math.abs(parseFloat(value) || 0)
              }))
            }}
            className="pl-7"
            placeholder={t('income.amountPlaceholder')}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
      </div>

      <div className="space-y-2">
        <Label htmlFor="recurrence">{t('income.recurrence')}</Label>
        <select
          id="recurrence"
          name="recurrence"
          value={formData.recurrence}
          onChange={handleChange}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          required
        >
          {recurrenceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.key)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit">{isEditing ? t('income.updateIncomeButton') : t('income.addIncomeButton')}</Button>
      </div>
    </form>
  )
}
