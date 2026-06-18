import { useState } from "react"
import { useTranslation } from 'react-i18next';
import { Plus } from "lucide-react"
import { SavingGoalCard } from "@presentation/components/dashboard/saving-goal/saving-goal-card"
import { useFetchSavings } from "@adapters/query/dashboard"
import { DeleteAllSavingGoalsButton } from "@presentation/components/dashboard/saving-goal/delete-all-saving-goal"
import AddSavingGoalButton from "@presentation/components/dashboard/saving-goal/add-saving-goal"
import { useSelector } from "react-redux"
import { RootState } from "@adapters/store/rootStore"
import { Currency, currencyService } from "@presentation/utils/currencyService"
import { PageHeader } from "@presentation/components/ui/page-header"
import SavingsLoading from "@presentation/components/dashboard/saving-goal/savings-loading"

function SavingGoalsContent() {
  const { t } = useTranslation();
  const { data: goals, isLoading, isSuccess } = useFetchSavings()

  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting

  const filteredGoals = isSuccess && goals

  // Calculate total progress
  const totalTarget = isSuccess && goals.reduce((sum, goal) => sum + goal.target, 0)
  const totalCurrent = isSuccess && goals.reduce((sum, goal) => sum + goal.current, 0)
  const totalPercentage = typeof totalTarget === "number" && typeof totalCurrent === "number" && totalTarget > 0
    ? (totalCurrent / totalTarget) * 100
    : 0;

  const targetCurrency = (settings?.currency || 'USD') as Currency;
  const formattedTarget = currencyService.formatCurrency(
    totalTarget as number,
    'USD' as Currency,
    targetCurrency,
    false
  );

  const formattedCurrent = currencyService.formatCurrency(
    totalCurrent as number,
    'USD' as Currency,
    targetCurrency,
    false
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t('savings.title')} description={t('savings.description')} />

      {/* Summary Card */}
      {isSuccess && goals.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-lg font-semibold">{t('savings.overallProgress')}</h2>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {formattedCurrent.formatted} {t('savings.of')} {formattedTarget.formatted}
            </div>
            <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
              {totalPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-2 rounded-full bg-purple-500" style={{ width: `${Math.min(totalPercentage, 100)}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-end">
        <div className="flex gap-2">
          <AddSavingGoalButton />
          <DeleteAllSavingGoalsButton />
        </div>
      </div>

      {isLoading ? (
        <SavingsLoading />
      ) : Array.isArray(filteredGoals) && filteredGoals.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGoals.map((goal) => (
            <SavingGoalCard key={goal.id} goal={goal} targetCurrency={targetCurrency} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center border border-dashed rounded-lg border-slate-200 dark:border-slate-700">
          {isSuccess && goals.length > 0 ? (
            <>
              <p className="text-slate-500 dark:text-slate-400">{t('savings.noMatchingGoals')}</p>
              <button
                onClick={() => setSearchTerm("")}
                className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
              >
                {t('savings.clearSearch')}
              </button>
            </>
          ) : (
            <>
              <div className="rounded-full bg-purple-100 p-3 text-purple-600 dark:bg-purple-900 dark:text-purple-300">
                <Plus className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-medium">{t('savings.noGoalsYet')}</h3>
              <p className="text-slate-500 dark:text-slate-400">{t('savings.createFirstDescription')}</p>
              <AddSavingGoalButton />
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function SavingGoalPage() {
  return (
    <SavingGoalsContent />
  )
}
