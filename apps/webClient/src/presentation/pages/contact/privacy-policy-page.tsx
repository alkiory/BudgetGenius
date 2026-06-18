import { RoutePaths } from "@presentation/utils/routes";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export default function PrivacyPolicyPage() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto px-4 py-12 text-primary dark:text-neutral">
      <div className="mb-8 flex items-center justify-between">
        <Link
          to={RoutePaths.Home}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t("contact.backToHome")}</span>
        </Link>
      </div>

      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("contact.privacyPolicy")}
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {t("contact.lastUpdated")}
          </p>
        </div>

        <div className="prose gap-5 dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-lead:text-slate-500 dark:prose-lead:text-slate-400 prose-a:text-purple-600 dark:prose-a:text-purple-400">
          <p className="lead">{t("contact.privacyPolicyLead")}</p>

          <h2 className="mt-8 text-xl font-semibold">
            {t("contact.privacyInfoCollect")}
          </h2>
          <p>{t("contact.privacyInfoCollectIntro")}</p>
          <ul className="list-disc pl-6">
            {t("contact.privacyInfoCollectList", { returnObjects: true }).map(
              (item: string, i: number) => (
                <li key={i} className="mb-2">
                  {item}
                </li>
              ),
            )}
          </ul>

          <h2 className="mt-8 text-xl font-semibold">
            {t("contact.privacyHowWeUse")}
          </h2>
          <p>{t("contact.privacyHowWeUseIntro")}</p>
          <ul className="list-disc pl-6">
            {t("contact.privacyHowWeUseList", { returnObjects: true }).map(
              (item: string, i: number) => (
                <li key={i} className="mb-2">
                  {item}
                </li>
              ),
            )}
          </ul>

          <h2 className="mt-8 text-xl font-semibold">
            {t("contact.privacyAI")}
          </h2>
          <p>{t("contact.privacyAIIntro")}</p>
          <ul className="list-disc pl-6">
            {t("contact.privacyAIList", { returnObjects: true }).map(
              (item: string, i: number) => (
                <li key={i} className="mb-2">
                  {item}
                </li>
              ),
            )}
          </ul>
          <p>{t("contact.privacyAIClosing")}</p>

          <h2>{t("contact.privacyDataSecurity")}</h2>
          <p>{t("contact.privacyDataSecurityBody")}</p>

          <h2>{t("contact.privacyDataRetention")}</h2>
          <p>{t("contact.privacyDataRetentionBody")}</p>

          <h2 className="mt-8 text-xl font-semibold">
            {t("contact.privacyYourRights")}
          </h2>
          <p>{t("contact.privacyYourRightsIntro")}</p>
          <ul className="list-disc pl-6">
            {t("contact.privacyYourRightsList", { returnObjects: true }).map(
              (item: string, i: number) => (
                <li key={i} className="mb-2">
                  {item}
                </li>
              ),
            )}
          </ul>

          <h2 className="mt-8 text-xl font-semibold">
            {t("contact.privacyChanges")}
          </h2>
          <p>{t("contact.privacyChangesBody")}</p>

          <h2>{t("contact.privacyContact")}</h2>
          <p>{t("contact.privacyContactBody")}</p>
          <p>
            <strong>{t("contact.email")}</strong>{" "}
            <a
              href="mailto:privacy@budgetgenius.com"
              className="text-secondary dark:text-secondary-foreground"
            >
              {t("contact.privacyContactEmail")}
            </a>
            <br />
            <strong>{t("contact.address")}</strong>{" "}
            {t("contact.privacyContactAddress")}
          </p>
        </div>
      </div>
    </div>
  );
}
