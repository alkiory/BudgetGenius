import { useState } from "react"
import { useTranslation } from 'react-i18next';
import { Edit2, Trash2, Plus, AlertCircle, TrendingUp, CreditCard, Wallet, DollarSign, Target } from "lucide-react"
import { GoalModal } from "./goal-modal"
import { Goal } from "@domain/dashboard/goals/goal.entity"
import { Button } from "@presentation/components/ui/button"
import { useMutation } from "@tanstack/react-query"
import { HttpGoalRepository } from "@adapters/http/goal.repository"
import { successToast, errorToast } from "@presentation/utils/toast"
import { RootState } from "@adapters/store/rootStore"
import { Currency, currencyService } from "@presentation/utils/currencyService"
import { useSelector } from "react-redux"

interface GoalCardProps {
  goal: Goal
  refetchParent: () => void
}

export function GoalCard({ goal, refetchParent }: GoalCardProps) {
  const { t } = useTranslation();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddingProgress, setIsAddingProgress] = useState(false)
  const [progressAmount, setProgressAmount] = useState("")

  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting

  const percentComplete = goal.targetAmount > 0 ? ((goal.currentAmount || 0) / goal.targetAmount) * 100 : 0
  const remaining = goal.targetAmount - (goal.currentAmount || 0)
  const isCompleted = goal.status === "completed"

  // Calculate days remaining
  const today = new Date()
  const dueDate = new Date(goal.dueDate)
  const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  // Calculate if goal is on track
  const daysPassed = Math.ceil((today.getTime() - new Date(goal.startDate).getTime()) / (1000 * 60 * 60 * 24))
  const totalDays = Math.ceil((dueDate.getTime() - new Date(goal.startDate).getTime()) / (1000 * 60 * 60 * 24))
  const expectedProgress = totalDays > 0 ? (daysPassed / totalDays) * 100 : 0
  const isOnTrack = percentComplete >= expectedProgress

  const targetCurrency = (settings?.currency || 'USD') as Currency;
  const formattedRemaining = currencyService.formatCurrency(
    remaining,
    'USD' as Currency,
    targetCurrency,
    false
  );

  const formattedCurrentAmount = currencyService.formatCurrency(
    goal.currentAmount || 0,
    'USD' as Currency,
    targetCurrency,
    false
  );

  const formattedTargetAmount = currencyService.formatCurrency(
    goal.targetAmount,
    'USD' as Currency,
    targetCurrency,
    false
  );

  const { mutate: updateGoalProgress } = useMutation({
    mutationKey: ['update-goal-progress'],
    mutationFn: HttpGoalRepository.updateGoalProgress,
    onSuccess: () => {
      successToast("Goal updated successfully", 3000, "goal-update")
      refetchParent();
    },
    onError: () => {
      errorToast("Failed to update goal", 3000, "goal-update")
    }
  })

  const { mutate: deleteGoal } = useMutation({
    mutationKey: ['delete-goal'],
    mutationFn: HttpGoalRepository.deleteGoal,
    onSuccess: () => {
      successToast("Goal deleted successfully", 3000, "goal-delete")
      refetchParent();
    },
    onError: () => {
      errorToast("Failed to delete goal", 3000, "goal-delete")
    }
  })

  // Get icon based on goal type
  const getGoalIcon = () => {
    switch (goal.type) {
      case "short-term":
        return <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      case "debt-payoff":
        return <CreditCard className="h-5 w-5 text-red-600 dark:text-red-400" />
      case "emergency-fund":
        return <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
      case "big-purchase":
        return <Wallet className="h-5 w-5 text-green-600 dark:text-green-400" />
      case "investment":
        return <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
      default:
        return <DollarSign className="h-5 w-5 text-slate-600 dark:text-slate-400" />
    }
  }

  const handleAddProgress = () => {
    const amount = Number(progressAmount)
    if (amount > 0) {
      updateGoalProgress({ goalId: goal.id as number, amount })
      setProgressAmount("")
      setIsAddingProgress(false)
    }
  }

  const handleDeleteGoal = () => {
    if (window.confirm(t('goals.deleteConfirm'))) {
      deleteGoal(goal.id as number)
    }
  }

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-slate-100 p-2 dark:bg-slate-700">{getGoalIcon()}</div>
            <div>
              <h3 className="font-medium">{goal.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{goal.description}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditModalOpen(true)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
              onClick={handleDeleteGoal}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span>
              {formattedCurrentAmount.formatted} {t('savings.of')} {formattedTargetAmount.formatted}
            </span>
            <span className="font-medium">{Math.round(percentComplete)}%</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
            <div
              className={`h-2 rounded-full ${isCompleted ? "bg-green-500" : isOnTrack ? "bg-blue-500" : "bg-yellow-500"
                }`}
              style={{ width: `${Math.min(percentComplete, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-slate-500 dark:text-slate-400">{t('goals.remaining' + '')}:</span>
            <span className="ml-1 font-medium">{formattedRemaining.formatted}</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">{t('goals.due')}:</span>
            <span className="ml-1 font-medium">{goal.dueDate}</span>
          </div>
          {goal.currentAmount && (
            <>
              <div>
                <span className="text-slate-500 dark:text-slate-400">{t('goals.contributing')}:</span>
                <span className="ml-1 font-medium">
                  {formattedCurrentAmount.formatted} {goal.contributionFrequency}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">{t('goals.statusLabel')}:</span>
                <span
                  className={`ml-1 font-medium ${isCompleted
                    ? "text-green-600 dark:text-green-400"
                    : isOnTrack
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-yellow-600 dark:text-yellow-400"
                    }`}
                >
                  {isCompleted ? t('transactions.statusCompleted') : isOnTrack ? t('goals.onTrack') : t('goals.needsAttention')}
                </span>
              </div>
            </>
          )}
        </div>

        {daysRemaining > 0 && !isCompleted && (
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('goals.daysRemaining', { count: daysRemaining })}</div>
        )}

        {isCompleted ? (
          <div className="mt-4 rounded-md bg-green-50 p-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
            {t('goals.congratulations')}
          </div>
        ) : (
          <div className="mt-4">
            {isAddingProgress ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={progressAmount}
                    onChange={(e) => setProgressAmount(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 pl-7 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder={t('transactions.amount')}
                  />
                </div>
                <Button size="sm" onClick={handleAddProgress}>
                  {t('goals.add')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsAddingProgress(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => setIsAddingProgress(true)}>
                <Plus className="h-4 w-4" />
                {t('goals.addProgress')}
              </Button>
            )}
          </div>
        )}
      </div>

      <GoalModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        goal={goal}
        refetchParent={refetchParent}
      />
    </>
  )
}
