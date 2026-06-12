import { useTranslation } from 'react-i18next';
import { RootState } from "@adapters/store/rootStore"
import { Goal, GoalType } from "@domain/dashboard/goals/goal.entity"
import { Button } from "@presentation/components/ui/button"
import { Input } from "@presentation/components/ui/input"
import { Label } from "@presentation/components/ui/label"
import { Textarea } from "@presentation/components/ui/textarea"
import { Currency, currencyService } from "@presentation/utils/currencyService"
import { errorToast, warningToast } from "@presentation/utils/toast"
import type React from "react"
import { useState, useEffect } from "react"
import { useSelector } from "react-redux"


interface GoalFormProps {
  goal?: Goal
  onSubmit: (goal: Omit<Goal, "id" | "status">) => void
  onCancel: () => void
}

const getInitialDates = () => {
  const today = new Date();
  const threeMonthsLater = new Date(today);
  threeMonthsLater.setMonth(today.getMonth() + 3);
  return {
    start: today.toISOString().split("T")[0],
    due: threeMonthsLater.toISOString().split("T")[0],
  };
};

export function GoalForm({ goal, onSubmit, onCancel }: GoalFormProps) {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);
  const { settings } = userSetting;

  const GOAL_TYPES: { value: GoalType; label: string }[] = [
    { value: "short-term", label: t('goals.typeShortTerm') },
    { value: "debt-payoff", label: t('goals.typeDebtPayoff') },
    { value: "emergency-fund", label: t('goals.typeEmergencyFund') },
    { value: "big-purchase", label: t('goals.typeBigPurchase') },
    { value: "investment", label: t('goals.typeInvestment') },
  ]

  const CONTRIBUTION_FREQUENCIES = [
    { value: "daily", label: t('goals.frequencyDaily') },
    { value: "weekly", label: t('goals.frequencyWeekly') },
    { value: "monthly", label: t('goals.frequencyMonthly') },
  ]

  const defaultDates = getInitialDates();

  const [formData, setFormData] = useState({
    name: goal?.name || "",
    description: goal?.description || null,
    type: goal?.type || "short-term",
    targetAmount: goal?.targetAmount || 0,
    startDate: goal?.startDate || defaultDates.start,
    dueDate: goal?.dueDate || defaultDates.due,
    contributionFrequency: goal?.contributionFrequency || "monthly",
    currentAmount: goal?.currentAmount || 0,
    notes: goal?.notes || "",
  });

  useEffect(() => {
    if (goal) {
      setFormData({
        name: goal.name,
        description: goal.description || null,
        type: goal.type,
        targetAmount: goal.targetAmount,
        startDate: goal.startDate,
        dueDate: goal.dueDate,
        contributionFrequency: goal.contributionFrequency || "monthly",
        currentAmount: goal.currentAmount,
        notes: goal.notes || "",
      });
    }
  }, [goal]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (Number(formData.currentAmount) > Number(formData.targetAmount)) {
      errorToast(t('goals.errorContributionExceeds'), 3000, "invalid-contribution")
      return
    }

    if (Number(formData.currentAmount) < 0) {
      errorToast(t('goals.errorNegativeContribution'), 3000, "invalid-contribution")
      return
    }

    if (Number(formData.targetAmount) <= 0) {
      errorToast(t('goals.errorTargetMustBePositive'), 3000, "invalid-target-amount")
      return
    }

    // compare goal data with fornData to see if there are any changes
    if (
      goal &&
      goal.name === formData.name &&
      goal.description === formData.description &&
      goal.type === formData.type &&
      goal.targetAmount === Number(formData.targetAmount) &&
      goal.startDate === formData.startDate &&
      goal.dueDate === formData.dueDate &&
      goal.contributionFrequency === formData.contributionFrequency &&
      goal.currentAmount === Number(formData.currentAmount) &&
      goal.notes === formData.notes
    ) {
      warningToast(t('goals.warningNoChanges'), 3000, "no-changes")
      onCancel()
      return
    }

    onSubmit({
      name: formData.name,
      description: formData.description,
      type: formData.type,
      targetAmount: Number(formData.targetAmount) || 0,
      startDate: formData.startDate,
      dueDate: formData.dueDate,
      contributionFrequency: formData.contributionFrequency as "daily" | "weekly" | "monthly",
      currentAmount: Number(formData.currentAmount) || 0,
      notes: formData.notes || undefined,
    })
  }

  // Calculate recommended contribution based on target amount and dates
  const calculateRecommendedContribution = () => {
    const targetAmount = Number(formData.targetAmount) || 0
    const amountNeeded = targetAmount - (Number(formData.currentAmount) || 0)

    if (amountNeeded <= 0 || !formData.startDate || !formData.dueDate) {
      return 0
    }

    const startDate = new Date(formData.startDate)
    const dueDate = new Date(formData.dueDate)
    const daysRemaining = Math.max(1, Math.ceil((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))

    let divisor = 1
    switch (formData.contributionFrequency) {
      case "daily":
        divisor = 1
        break
      case "weekly":
        divisor = 7
        break
      case "monthly":
        divisor = 30
        break
    }

    const periods = Math.ceil(daysRemaining / divisor)
    return periods > 0 ? Math.ceil(amountNeeded / periods) : amountNeeded
  }

  const recommendedContribution = calculateRecommendedContribution()

  const targetCurrency = (settings?.currency || 'USD') as Currency;
  const formattedTarget = currencyService.formatCurrency(
    formData.targetAmount,
    targetCurrency as Currency,
    targetCurrency,
    false
  );

  const formattedCurrentAmount = currencyService.formatCurrency(
    formData.currentAmount,
    targetCurrency as Currency,
    targetCurrency,
    false
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4 overflow-y-auto max-h-[60vh]">
        <div className="space-y-2">
          <Label htmlFor="name">{t('goals.goalName')}</Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder={t('goals.namePlaceholder')}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t('goals.descriptionLabel')}</Label>
          <Input
            id="description"
            name="description"
            value={formData.description || ""}
            onChange={handleChange}
            placeholder={t('goals.descriptionPlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">{t('goals.goalType')}</Label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            required
          >
            {GOAL_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="targetAmount">{t('goals.targetAmount')}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{formattedTarget.symbol}</span>
              <Input
                id="targetAmount"
                name="targetAmount"
                type="number"
                min="0"
                step="0.01"
                value={formData.targetAmount}
                onChange={handleChange}
                className="pl-7"
                required
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">{t('goals.startDate')}</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              value={formData.startDate}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">{t('goals.targetDate')}</Label>
            <Input id="dueDate" name="dueDate" type="date" value={formData.dueDate} onChange={handleChange} required />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contributionFrequency">{t('goals.contributionFrequency')}</Label>
          <select
            id="contributionFrequency"
            name="contributionFrequency"
            value={formData.contributionFrequency}
            onChange={handleChange}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {CONTRIBUTION_FREQUENCIES.map((frequency) => (
              <option key={frequency.value} value={frequency.value}>
                {frequency.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="currentAmount">{t('goals.contributionAmount')}</Label>
            {recommendedContribution > 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {t('goals.recommended')}: {formattedTarget.symbol}{recommendedContribution}
              </span>
            )}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{formattedCurrentAmount.symbol}</span>
            <Input
              id="currentAmount"
              name="currentAmount"
              type="number"
              min="0"
              step="0.01"
              value={formData.currentAmount}
              onChange={handleChange}
              className="pl-7"
              placeholder={recommendedContribution > 0 ? recommendedContribution.toString() : "0"}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">{t('goals.notesOptional')}</Label>
          <Textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder={t('goals.notesPlaceholder')}
            className="min-h-[100px]"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit">{goal ? t('goals.updateGoalButton') : t('goals.createGoalButton')}</Button>
      </div>
    </form>
  )
}
