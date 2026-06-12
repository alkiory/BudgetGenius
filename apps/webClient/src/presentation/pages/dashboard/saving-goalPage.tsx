import { useState } from "react"
import { useTranslation } from 'react-i18next';
import { Search, Plus, Loader } from "lucide-react"
import { SavingGoalCard } from "@presentation/components/dashboard/saving-goal/saving-goal-card"
import { useFetchSavings } from "@adapters/query/dashboard"
import { DeleteAllSavingGoalsButton } from "@presentation/components/dashboard/saving-goal/delete-all-saving-goal"
import AddSavingGoalButton from "@presentation/components/dashboard/saving-goal/add-saving-goal"
import { useSelector } from "react-redux"
import { RootState } from "@adapters/store/rootStore"
import { Currency, currencyService } from "@presentation/utils/currencyService"

function SavingGoalsContent() {
  const { t } = useTranslation();
  const { data: goals, isLoading, isSuccess } = useFetchSavings()
  const [searchTerm, setSearchTerm] = useState("")

  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting

  // Filter goals based on search term
  const filteredGoals = isSuccess && goals.filter(
    (goal) =>
      goal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      goal.category?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('savings.title')}</h1>
        <p className="text-slate-500 dark:text-slate-400">{t('savings.description')}</p>
      </div>

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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative w-full max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder={t('savings.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white py-2 pl-10 pr-3 text-slate-900 placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder-slate-400"
          />
        </div>
        <div className="flex gap-2">
          <AddSavingGoalButton />
          <DeleteAllSavingGoalsButton />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader />
        </div>
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
