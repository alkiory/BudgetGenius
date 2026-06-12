import { useTranslation } from 'react-i18next';
import { SavingGoal } from "@domain/dashboard/saving-goal/saving.entity"
import { CalendarClock, DollarSign, Target } from "lucide-react"
import DeleteSavingGoalButton from "./delete-saving-goal"
import EditSavingGoalButton from "./edit-saving-goal"
import { Currency, currencyService } from "@presentation/utils/currencyService"

interface SavingGoalCardProps {
  goal: SavingGoal
  targetCurrency: Currency
}

export function SavingGoalCard({ goal, targetCurrency }: SavingGoalCardProps) {
  const { t } = useTranslation();
  const percentage = Math.min(goal.percentage ?? 0, 100)
  const remainingAmount = goal.target - goal.current
  const isCompleted = percentage >= 100

  const formattedTarget = currencyService.formatCurrency(
    goal.target as number,
    'USD' as Currency,
    targetCurrency,
    false
  );

  const formattedCurrent = currencyService.formatCurrency(
    goal.current as number,
    'USD' as Currency,
    targetCurrency,
    false
  );

  const formattedRemaining = currencyService.formatCurrency(
    remainingAmount,
    'USD' as Currency,
    targetCurrency,
    false
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{goal.name}</h3>
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
            {goal.category}
          </span>
        </div>
        <div className="flex space-x-1">
          <EditSavingGoalButton goal={goal} />
          <DeleteSavingGoalButton goalId={goal.id} goalName={goal.name} />
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          <DollarSign className="h-4 w-4" />
          <span>
            {formattedCurrent.formatted} {t('savings.of')} {formattedTarget.formatted}
          </span>
        </div>
        <span
          className={`text-sm font-medium ${isCompleted ? "text-green-600 dark:text-green-400" : "text-purple-600 dark:text-purple-400"
            }`}
        >
          {percentage.toFixed(1)}%
        </span>
      </div>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-2 rounded-full ${isCompleted ? "bg-green-500" : ""}`}
          style={{ width: `${percentage}%`, backgroundColor: isCompleted ? undefined : goal.color }}
        />
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        {goal.targetDate && (
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <CalendarClock className="h-4 w-4" />
            <span>{t('savings.target')}: {new Date(goal.targetDate).toLocaleDateString()}</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <Target className="h-4 w-4" />
          <span>
            {isCompleted ? (
              <span className="text-green-600 dark:text-green-400">{t('savings.goalCompleted')}</span>
            ) : (
              `${formattedRemaining.formatted} ${t('savings.toGo')}`
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
