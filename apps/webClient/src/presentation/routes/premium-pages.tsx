import { useTranslation } from 'react-i18next';
import { RootState } from '@adapters/store/rootStore';
import { PremiumUpgradeModal } from '@presentation/components/modal/premium-upgrade-modal';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Outlet } from 'react-router';

const PremiumRoute = () => {
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user);
  const isPremium = !!user?.isPremium;

  const [showPremiumCard, setShowPremiumCard] = useState(false);

  const handleClosePremiumCard = () => setShowPremiumCard(false);

  useEffect(() => {
    if (user && !isPremium) {
      const timer = setTimeout(() => {
        setShowPremiumCard(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [user, isPremium]);

  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-400">{t('upgrade.premiumFeature')}</h3>
        <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-sm font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-300">
          {t('upgrade.premium')}
        </span>
      </div>

      {isPremium ? <Outlet /> : (
        <div className="py-10 text-center text-slate-400">
          {t('upgrade.premiumFeature')}
        </div>
      )}

      {showPremiumCard && (
        <PremiumUpgradeModal
          isOpen={true}
          onClose={handleClosePremiumCard}
          featureName={t('upgrade.premiumFeature')}
        />
      )}
    </div>
  );
};

export default PremiumRoute;