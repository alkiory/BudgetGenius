import { useTranslation } from 'react-i18next';
import { ChartColumnIncreasing } from "lucide-react";

export default function InvestmentPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('sidebar.investments')}</h1>
      <p className="text-muted-foreground">{t('investments.underConstruction')}</p>
      <ChartColumnIncreasing
        className="mx-auto h-24 w-24 text-muted-foreground animate-bounce"
      />
    </div>
  )
}