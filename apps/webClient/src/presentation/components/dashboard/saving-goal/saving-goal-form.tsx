import { useTranslation } from 'react-i18next';
import { SavingGoal } from "@domain/dashboard/saving-goal/saving.entity"
import { TRANSACTION_CATEGORIES } from "@domain/dashboard/transactions/transaction.entity"
import { Button } from "@presentation/components/ui/button"
import { Input } from "@presentation/components/ui/input"
import { Label } from "@presentation/components/ui/label"
import { useSelector } from "react-redux";
import { RootState } from "@adapters/store/rootStore";
import { Currency, currencyService } from "@presentation/utils/currencyService";
import type React from "react"
import { useState, useEffect } from "react"


interface SavingGoalFormProps {
  goal?: SavingGoal
  onSubmit: (goal: Omit<SavingGoal, "id" | "percentage">) => void
  onCancel: () => void
  isLoading?: boolean
}

const COLORS = [
  "#10b981", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#6b7280", // gray
  "#0ea5e9", // sky
]

export function SavingGoalForm({ goal, onSubmit, onCancel, isLoading }: SavingGoalFormProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const targetCurrency = (userSetting?.settings?.currency || 'USD') as Currency;
  const currencySymbol = currencyService.getSymbol(targetCurrency);

  const [formData, setFormData] = useState<Omit<SavingGoal, "id">>({
    name: "",
    target: undefined as unknown as number,
    current: undefined as unknown as number,
    targetDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    category: "Other",
    color: COLORS[0],
  })

  // If editing an existing goal, populate the form
  useEffect(() => {
    if (goal) {
      setFormData({
        name: goal.name,
        target: goal.target,
        current: goal.current,
        targetDate: goal.targetDate instanceof Date ? goal.targetDate : new Date(goal.targetDate!),
        category: goal.category || "Other",
        color: goal.color || COLORS[0],
      })
    }
  }, [goal])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'targetDate') {
      const dateValue = value ? new Date(value) : undefined;
      setFormData((prev) => ({ ...prev, [name]: dateValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()


    let targetDate: Date;
    if (formData.targetDate instanceof Date) {
      targetDate = formData.targetDate;
    } else {
      targetDate = new Date(formData.targetDate!);
    }

    const rawTarget = Number(formData.target) || 0;
    const rawCurrent = Number(formData.current) || 0;

    onSubmit({
      name: formData.name,
      target: currencyService.normalizeAmount(rawTarget, targetCurrency),
      current: currencyService.normalizeAmount(rawCurrent, targetCurrency),
      targetDate,
      category: formData.category,
      color: formData.color,
    })
  }

  const isEditing = !!goal

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t('savings.goalName')}</Label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder={t('savings.eGPlaceholder')}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="target">{t('savings.targetAmount')}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{currencySymbol}</span>
            <Input
              id="target"
              name="target"
              type="number"
              step="0.01"
              min="0"
              value={formData.target ?? ""}
              onChange={(e) => {
                const { value } = e.target
                setFormData(prev => ({
                  ...prev,
                  target: value === "" ? undefined as unknown as number : Math.abs(parseFloat(value) || 0)
                }))
              }}
              className="pl-7"
              placeholder="0.00"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="current">{t('savings.currentAmount')}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{currencySymbol}</span>
            <Input
              id="current"
              name="current"
              type="number"
              step="0.01"
              min="0"
              value={formData.current ?? ""}
              onChange={(e) => {
                const { value } = e.target
                setFormData(prev => ({
                  ...prev,
                  current: value === "" ? undefined as unknown as number : Math.abs(parseFloat(value) || 0)
                }))
              }}
              className="pl-7"
              placeholder="0.00"
              required
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetDate">{t('savings.targetDate')}</Label>
        <Input
          id="targetDate"
          name="targetDate"
          type="date"
          value={formData.targetDate?.toISOString().split('T')[0]}
          onChange={handleChange}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">{t('savings.category')}</Label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          required
        >
          {TRANSACTION_CATEGORIES.filter(category => category !== "All" && category !== "Todos").map((category) => (
            <option key={category} value={category}>
              {t(`categories.${category.toLowerCase()}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>{t('savings.color')}</Label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, color }))}
              className={`h-8 w-8 rounded-full ${formData.color === color ? "ring-2 ring-offset-2 ring-purple-500" : ""
                }`}
              style={{ backgroundColor: color }}
              aria-label={t('savings.selectColor', { color })}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button disabled={isLoading} type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit">{isEditing ? t('savings.updateGoal') : t('savings.addGoal')}</Button>
      </div>
    </form>
  )
}
