import { RootState } from "@adapters/store/rootStore";
import { SavingGoal } from "@domain/dashboard/saving-goal/saving.entity"
import { Currency, currencyService } from "@presentation/utils/currencyService";
import { useSelector } from "react-redux";

interface SavingGoalCardProps {
  goal: SavingGoal
}

export function SavingGoalCardMini({ goal }: SavingGoalCardProps) {
  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting
  const percentage = Math.min(goal.percentage ?? 0, 100)
  const isCompleted = percentage >= 100

  const targetCurrency = (settings?.currency || 'USD') as Currency;
  const formattedCurrent = currencyService.formatCurrency(
    goal.current,
    targetCurrency as Currency,
    targetCurrency,
    false
  );

  const formattedTarget = currencyService.formatCurrency(
    goal.target,
    targetCurrency as Currency,
    targetCurrency,
    false
  );

  let speedClass = '';
  if (percentage >= 70) {
    speedClass = 'is-fast';
  } else if (percentage < 40) {
    speedClass = 'is-slow';
  }

  return (
    <div key={goal.id} className="rounded-lg border border-slate-100 p-4 dark:border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">{goal.name}</h3>
        <span className="text-sm text-slate-500 dark:text-slate-400">{goal.percentage}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className={`
            h-2
            rounded-full
            progress-shim
            ${speedClass}
            ${isCompleted ? "bg-green-500" : ""}
          `}
          style={{
            width: `${percentage}%`,
          }}
        >
        </div>
      </div>
      <div className="mt-2 flex justify-between text-sm">
        <span className="text-slate-500 dark:text-slate-400">${formattedCurrent.formatted}</span>
        <span className="text-slate-500 dark:text-slate-400">${formattedTarget.formatted}</span>
      </div>
    </div>
  )
}
