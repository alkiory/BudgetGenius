import { useTranslation } from 'react-i18next';
import { Crown } from "lucide-react";
import { PremiumUpgradeModal } from "./premium-upgrade-modal";
import { useState } from "react";

interface Props {
  message?: string
  onClose: () => void
}
export default function PremiumCard({ message, onClose }: Props) {
  const { t } = useTranslation();
  const [showPremiumCard, setShowPremiumCard] = useState(false);

  const featureName = message || t('upgrade.premiumFeature');

  const handleUpgrade = () => {
    setShowPremiumCard(true);
  }
  return (
    <>
      <div className="rounded-lg border border-dashed border-purple-300 bg-purple-50 p-6 text-center shadow-sm dark:border-purple-800/30 dark:bg-purple-900/10 animate-scale-in">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
          <Crown className="h-6 w-6 text-purple-600 dark:text-purple-400 animate-wiggle animate-infinite" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-purple-800 dark:text-purple-300">{t('upgrade.premiumFeature')}</h3>
        <p className="mb-4 text-sm text-purple-700 dark:text-purple-400">
          {t('upgrade.upgradeToUnlock')}
        </p>
        <button onClick={handleUpgrade} className="inline-flex items-center rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-purple-700 hover:to-indigo-700">
          {t('upgrade.upgradeToPremium')}
        </button>
      </div>

      {showPremiumCard && (
        <PremiumUpgradeModal isOpen={true} onClose={onClose} featureName={featureName} />
      )}
    </>
  )
}