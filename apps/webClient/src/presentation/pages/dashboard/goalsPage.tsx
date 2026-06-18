import { useState } from "react"
import { useTranslation } from 'react-i18next';
import { Plus } from "lucide-react"
import { Goal, GoalFilterType, GoalProgress } from "@domain/dashboard/goals/goal.entity"
import { GoalCard } from "@presentation/components/dashboard/goals/goal-card"
import { GoalModal } from "@presentation/components/dashboard/goals/goal-modal"
import { Button } from "@presentation/components/ui/button"
import { PageHeader } from "@presentation/components/ui/page-header"
import { useFetchGoals } from "@adapters/query/dashboard"
import GoalsLoading from "@presentation/components/dashboard/goals/goal-loading"
import { useGoalProgress } from "@adapters/hooks/dashboard/goal-progress.hook"
import { useFilteredGoals } from "@adapters/hooks/dashboard/goal-filtered.hook"
import { RootState } from "@adapters/store/rootStore"
import { Currency, currencyService } from "@presentation/utils/currencyService"
import { useSelector } from "react-redux"

export function GoalsPage() {
  const { t } = useTranslation();
  const { data: goals, isLoading, refetch } = useFetchGoals()
  const [selectedType, setSelectedType] = useState<GoalFilterType>("all")
  const [isModalOpen, setIsModalOpen] = useState(false)

  const FILTER_TYPES: { value: GoalFilterType; label: string }[] = [
    { value: "all", label: t('goals.filterAll') },
    { value: "short-term", label: t('goals.filterShortTerm') },
    { value: "debt-payoff", label: t('goals.filterDebtPayoff') },
    { value: "emergency-fund", label: t('goals.filterEmergencyFund') },
    { value: "big-purchase", label: t('goals.filterBigPurchase') },
    { value: "investment", label: t('goals.filterInvestment') },
  ]

  const filteredGoals = useFilteredGoals(goals, "", selectedType)
  const overallProgress = useGoalProgress(goals)

  if (isLoading) return <GoalsLoading />

  return (
    <div className="space-y-6">
      <PageHeader title={t('goals.title')} description={t('goals.description')}>
        <Button variant="primary" onClick={() => setIsModalOpen(true)} className="gap-1">
          <Plus className="h-4 w-4" />
          {t('goals.createGoal')}
        </Button>
      </PageHeader>

      {/* Progreso general */}
      <ProgressSection progress={overallProgress} />

      {/* Type filters */}
      <div className="flex items-center justify-end">
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {FILTER_TYPES.map(({ value, label }) => (
            <FilterButton
              key={value}
              isActive={selectedType === value}
              onClick={() => setSelectedType(value)}
              label={label}
            />
          ))}
        </div>
      </div>

      {/* Lista de metas */}
      <GoalsList
        goals={filteredGoals}
        selectedType={selectedType}
        onClearFilters={() => {
          setSelectedType("all")
        }}
        onCreateGoal={() => setIsModalOpen(true)}
        refetchParent={refetch}
      />

      <GoalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        refetchParent={refetch}
      />
    </div>
  )
}

// Componente de progreso
const ProgressSection = ({ progress }: { progress: GoalProgress }) => {
  const { t } = useTranslation();
  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting

  const targetCurrency = (settings?.currency || 'USD') as Currency;
  const formattedCurrent = currencyService.formatCurrency(
    progress.totalCurrent,
    'USD' as Currency,
    targetCurrency,
    false
  );

  const formattedTarget = currencyService.formatCurrency(
    progress.totalTarget,
    'USD' as Currency,
    targetCurrency,
    false
  );
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
      <h2 className="text-lg font-semibold mb-4">{t('goals.overallProgress')}</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('goals.totalGoals')}
          value={progress.goalsCount}
          subText={`${progress.completedCount} ${t('goals.completed')}`}
        />
        <StatCard
          label={t('goals.totalTarget')}
          value={`${formattedTarget.formatted}`}
        />
        <StatCard
          label={t('goals.totalSaved')}
          value={`${formattedCurrent.formatted}`}
          subText={t('goals.ofTarget', { percent: Math.round(progress.percentComplete) })}
          subTextClass="text-green-600 dark:text-green-400"
        />
        <StatCard
          label={t('goals.remaining')}
          value={`${formattedTarget.symbol}${(formattedTarget.amount - formattedCurrent.amount).toFixed(2)}`}
        />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span>{t('goals.progress')}</span>
          <span className="font-medium">{Math.round(progress.percentComplete)}%</span>
        </div>
        <ProgressBar percent={progress.percentComplete} />
      </div>
    </div>
  )
}

// Componente de barra de progreso
const ProgressBar = ({ percent }: { percent: number }) => (
  <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
    <div
      className="h-2 rounded-full bg-purple-500 transition-all duration-300"
      style={{ width: `${Math.min(percent, 100)}%` }}
    />
  </div>
)

// Componente de estadística reutilizable
const StatCard = ({
  label,
  value,
  subText,
  subTextClass = "text-slate-500 dark:text-slate-400"
}: {
  label: string
  value: string | number
  subText?: string
  subTextClass?: string
}) => (
  <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
    <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
    <p className="mt-1 text-2xl font-bold">{value}</p>
    {subText && <p className={`mt-1 text-xs ${subTextClass}`}>{subText}</p>}
  </div>
)

// Componente de botón de filtro
const FilterButton = ({
  isActive,
  onClick,
  label
}: {
  isActive: boolean
  onClick: () => void
  label: string
}) => (
  <Button
    variant={isActive ? "secondary" : "outline"}
    size="sm"
    onClick={onClick}
    aria-pressed={isActive}
  >
    {label}
  </Button>
)

// Componente de lista de metas
const GoalsList = ({
  goals,
  selectedType,
  onClearFilters,
  onCreateGoal,
  refetchParent
}: {
  goals: Goal[]
  selectedType: string
  onClearFilters: () => void
  onCreateGoal: () => void
  refetchParent: () => void
}) => {
  const { t } = useTranslation();
  if (goals.length > 0) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} refetchParent={refetchParent} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center border border-dashed rounded-lg border-slate-200 dark:border-slate-700">
      <p className="text-slate-500 dark:text-slate-400">{t('goals.noGoals')}</p>
      {selectedType !== "all" ? (
        <Button variant="outline" onClick={onClearFilters}>
          {t('common.clearFilters')}
        </Button>
      ) : (
        <Button onClick={onCreateGoal}>{t('goals.createFirstGoal')}</Button>
      )}
    </div>
  )
}