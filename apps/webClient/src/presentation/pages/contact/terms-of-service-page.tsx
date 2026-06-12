import { RoutePaths } from "@presentation/utils/routes"
import { ArrowLeft } from "lucide-react"
import { Link } from "react-router"
import { useTranslation } from 'react-i18next';

export default function TermsOfServicePage() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto px-4 py-12 text-primary dark:text-neutral">
      <div className="mb-8 flex items-center justify-between">
        <Link
          to={RoutePaths.Home}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('contact.backToHome')}</span>
        </Link>
      </div>

      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('contact.termsOfService')}</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">{t('contact.lastUpdated')}</p>
        </div>

        <div className="prose gap-5 dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-lead:text-slate-500 dark:prose-lead:text-slate-400 prose-a:text-purple-600 dark:prose-a:text-purple-400">
          <p className="lead">{t('contact.tosLead')}</p>

          <h2>{t('contact.tosAcceptance')}</h2>
          <p>{t('contact.tosAcceptanceBody')}</p>

          <h2>{t('contact.tosChanges')}</h2>
          <p>{t('contact.tosChangesBody')}</p>

          <h2>{t('contact.tosAccountRegistration')}</h2>
          <p>{t('contact.tosAccountRegistrationBody')}</p>

          <h2>{t('contact.tosFinancialData')}</h2>
          <p>{t('contact.tosFinancialDataBody')}</p>
          <ul>
            {t('contact.tosFinancialDataList', { returnObjects: true }).map((item: string, i: number) => (
              <li key={i}>{item}</li>
            ))}
          </ul>

          <h2>{t('contact.tosAI')}</h2>
          <p>{t('contact.tosAIBody')}</p>
          <ul>
            {t('contact.tosAIList', { returnObjects: true }).map((item: string, i: number) => (
              <li key={i}>{item}</li>
            ))}
          </ul>

          <h2>{t('contact.tosUserContent')}</h2>
          <p>{t('contact.tosUserContentBody')}</p>

          <h2>{t('contact.tosProhibitedConduct')}</h2>
          <p>{t('contact.tosProhibitedConductIntro')}</p>
          <ul>
            {t('contact.tosProhibitedConductList', { returnObjects: true }).map((item: string, i: number) => (
              <li key={i}>{item}</li>
            ))}
          </ul>

          <h2>{t('contact.tosTermination')}</h2>
          <p>{t('contact.tosTerminationBody')}</p>

          <h2>{t('contact.tosDisclaimer')}</h2>
          <p>{t('contact.tosDisclaimerBody')}</p>

          <h2>{t('contact.tosLimitation')}</h2>
          <p>{t('contact.tosLimitationBody')}</p>

          <h2>{t('contact.tosGoverningLaw')}</h2>
          <p>{t('contact.tosGoverningLawBody')}</p>

          <h2>{t('contact.tosContact')}</h2>
          <p>{t('contact.tosContactBody')}</p>
          <p>
            <strong>{t('contact.email')}</strong> <a href="mailto:legal@budgetgenius.com" className="text-secondary dark:text-secondary-foreground">{t('contact.tosContactEmail')}</a>
            <br />
            <strong>{t('contact.address')}</strong> {t('contact.tosContactAddress')}
          </p>
        </div>
      </div>
    </div>
  )
}
