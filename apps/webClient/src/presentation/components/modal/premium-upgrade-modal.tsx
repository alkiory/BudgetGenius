import { useTranslation } from 'react-i18next';
import { useState } from "react"
import { BarChart3, Bell, Check, CreditCard, Crown, Sparkles, Target, TrendingUp } from "lucide-react"
import { Button } from "../ui/button"
import { Modal } from "./modal"
import { RoutePaths } from "@presentation/utils/routes"
import { useNavigate } from "react-router"

interface PremiumFeature {
  name: string
  description: string
  icon: React.ReactNode
}

interface PremiumModalProps {
  isOpen: boolean
  onClose: () => void
  featureName: string
  featureDescription?: string
}

export function PremiumUpgradeModal({ isOpen, onClose, featureName, featureDescription }: PremiumModalProps) {
  const { t } = useTranslation();
  const [isYearly, setIsYearly] = useState(true)

  // Calculate prices with annual discount
  const premiumMonthly = 4.99
  const annualDiscount = 0.2 // 20% discount

  const premiumPrice = isYearly ? (premiumMonthly * 12 * (1 - annualDiscount)).toFixed(2) : premiumMonthly.toFixed(2)

  const handlePlanChange = () => {
    setIsYearly(!isYearly)
  }

  const location = useNavigate();

  const goPremium = () => {
    onClose();
    location(RoutePaths.Upgrade);
  }

  const goDashboard = () => {
    onClose();
    location(RoutePaths.Dashboard);
  }

  const premiumFeatures: PremiumFeature[] = [
    {
      name: t('upgrade.unlimitedGoals'),
      description: t('upgrade.unlimitedGoalsDesc'),
      icon: <Target className="h-5 w-5 text-purple-500" />,
    },
    {
      name: t('upgrade.advancedReports'),
      description: t('upgrade.advancedReportsDesc'),
      icon: <BarChart3 className="h-5 w-5 text-purple-500" />,
    },
    {
      name: t('upgrade.debtPayoffPlanner'),
      description: t('upgrade.debtPayoffPlannerDesc'),
      icon: <CreditCard className="h-5 w-5 text-purple-500" />,
    },
    {
      name: t('upgrade.investmentTracking'),
      description: t('upgrade.investmentTrackingDesc'),
      icon: <TrendingUp className="h-5 w-5 text-purple-500" />,
    },
    {
      name: t('upgrade.billReminders'),
      description: t('upgrade.billRemindersDesc'),
      icon: <Bell className="h-5 w-5 text-purple-500" />,
    },
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="relative overflow-hidden rounded-t-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-8 text-white">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-purple-500 opacity-20"></div>
        <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-indigo-500 opacity-20"></div>
        <div className="relative flex items-center gap-3">
          <Crown className="h-8 w-8 text-yellow-300 animate-wiggle animate-infinite" />
          <div>
            <h2 className="text-2xl font-bold">{t('upgrade.upgradeToPremium')}</h2>
            <p className="text-purple-100">{featureDescription || t('upgrade.isAPremiumFeature', { featureName })}</p>
          </div>
        </div>
      </div>

      <div className="p-6 overflow-y-auto max-h-[70vh]">
        <div className="mb-6 rounded-lg border border-purple-100 bg-purple-50 p-4 dark:border-purple-900/30 dark:bg-purple-900/20">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-purple-100 p-1 dark:bg-purple-900/30">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 animate-wiggle animate-infinite" />
            </div>
            <div>
              <h3 className="font-medium text-purple-800 dark:text-purple-300">
                {t('upgrade.unlockFeatureName', { featureName })}
              </h3>
              <p className="text-sm text-purple-700 dark:text-purple-400">
                {t('savings.upgradeDescription')}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="mb-4 flex justify-center">
            <div className="inline-flex rounded-lg border border-slate-200 p-1 dark:border-slate-700">
              <button
                className={`rounded-md px-4 py-2 text-sm font-medium ${!isYearly
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                  }`}
                onClick={handlePlanChange}
              >
                {t('upgrade.monthly')}
              </button>
              <button
                className={`rounded-md px-4 py-2 text-sm font-medium ${isYearly
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                  }`}
                onClick={handlePlanChange}
              >
                {t('upgrade.annual')}
                <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-400 animate-pulse animate-infinite">
                  {t('upgrade.savePercent', { percent: 20 })}
                </span>
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-purple-200 bg-white p-6 shadow-sm dark:border-purple-800/30 dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{t('upgrade.premiumPlan')}</h3>
                <p className="text-slate-500 dark:text-slate-400">{t('upgrade.allFeaturesIncluded')}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">${premiumPrice}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{isYearly ? t('upgrade.perYear') : t('upgrade.perMonth')}</div>
              </div>
            </div>

            <div className="mt-4">
              <Button variant="primary" className="w-full" onClick={goPremium}>{t('upgrade.upgradeNow')}</Button>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-lg font-semibold">{t('upgrade.premiumFeaturesInclude')}</h3>
          <ul className="space-y-3">
            {premiumFeatures.map((feature, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="rounded-full bg-green-100 p-1 dark:bg-green-900/30">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="font-medium">{feature.name}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{feature.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex justify-between">
          <Button variant="outline" onClick={goDashboard}>
            {t('upgrade.maybeLater')}
          </Button>
          <Button variant="primary" onClick={goPremium}>{t('upgrade.upgradeToPremium')}</Button>
        </div>
      </div>
    </Modal>
  )
}

