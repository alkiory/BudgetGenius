import { useTranslation } from 'react-i18next';
import { useFetchSavings } from "@adapters/query/dashboard"
import Loader from "../loader"
import { Link } from "react-router"
import { RoutePaths } from "@presentation/utils/routes"
import { SavingGoalCardMini } from "./saving-goal/saving-goal-card-mini"
import { RootState } from "@adapters/store/rootStore"
import { useSelector } from "react-redux"
import { Sparkles } from "lucide-react"

export function SavingsGoals() {
  const { t } = useTranslation();
  const { data: goals, isLoading, isSuccess } = useFetchSavings()
  const user = useSelector((state: RootState) => state.auth.user)

  if (!user?.isPremium) {
    return (
      <div className=" rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t('savings.title')}</h2>
        </div>
        <div className="space-y-4">
          <div className="flex flex-col gap-5 items-center justify-center">
            <span className="text-muted-foreground">{t('dashboard.upgradeForSavings')}</span>
            <div className="mb-6 rounded-lg border border-purple-100 bg-purple-50 p-4 dark:border-purple-900/30 dark:bg-purple-900/20">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-purple-100 p-1 dark:bg-purple-900/30">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 animate-wiggle animate-infinite" />
                </div>
                <div>
                  <h3 className="font-medium text-purple-800 dark:text-purple-300">
                    {t('savings.unlockFeature')}
                  </h3>
                  <p className="text-sm text-purple-700 dark:text-purple-400">
                    {t('savings.upgradeDescription')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t('savings.title')}</h2>
        <Link
          to={RoutePaths.App + "/" + RoutePaths.Savings}
          className="flex items-center gap-1 text-sm text-purple-600 hover:underline dark:text-purple-400">
          {t('savings.viewAll')}
        </Link>
      </div>
      {isLoading && <Loader />}
      <div className="space-y-4">
        {isSuccess && goals.length > 0 ? goals?.slice(-1 * 3).map((goal) => (
          <SavingGoalCardMini key={goal.id} goal={goal} />
        )) : (
          <div className="flex items-center justify-center">
            <span className="text-muted-foreground">{t('dashboard.noSavingsYet')}</span>
          </div>
        )}
      </div>
    </div>
  )
}