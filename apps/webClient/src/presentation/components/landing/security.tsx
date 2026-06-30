import { Eye, Languages, Lock, ShieldCheck, UserCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

function CardIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
      {children}
    </div>
  );
}

interface TrustCardProps {
  iconKey: "auth" | "encryption" | "ownership" | "bilingual" | "transparency";
  icon: React.ReactNode;
}

function TrustCard({ iconKey, icon }: TrustCardProps) {
  const { t } = useTranslation();
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <CardIcon>{icon}</CardIcon>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
        {t(`landing.sectionSecurity.items.${iconKey}.title`)}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {t(`landing.sectionSecurity.items.${iconKey}.description`)}
      </p>
    </article>
  );
}

/**
 * Security / Trust section. 5 cards in a 3 + 2 layout:
 * - Row 1: 3 cards across the full grid (md+).
 * - Row 2: 2 cards with a centre spacer cell so the row reads as centered.
 * Copy is grounded in real BudgetGenius protections
 * (JWT + Google OAuth + Firebase auth, TLS 1.3, Postgres at-rest encryption,
 * Finny bilingual EN/ES, full data export). No fabricated certifications.
 */
export function Security() {
  return (
    <section className="relative isolate overflow-x-clip bg-slate-50 py-20 dark:bg-slate-900/40 lg:py-24">
      <div className="container mx-auto max-w-7xl px-6">
        <SectionHeader />

        {/* Row 1 — 3 cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <TrustCard
            iconKey="auth"
            icon={<ShieldCheck className="h-6 w-6" aria-hidden="true" />}
          />
          <TrustCard
            iconKey="encryption"
            icon={<Lock className="h-6 w-6" aria-hidden="true" />}
          />
          <TrustCard
            iconKey="ownership"
            icon={<UserCheck className="h-6 w-6" aria-hidden="true" />}
          />
        </div>

        {/* Row 2 — 2 cards, spacer cell in the middle so they land under cols 1 + 3 */}
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div aria-hidden="true" className="hidden md:block" />
          <TrustCard
            iconKey="bilingual"
            icon={<Languages className="h-6 w-6" aria-hidden="true" />}
          />
          <TrustCard
            iconKey="transparency"
            icon={<Eye className="h-6 w-6" aria-hidden="true" />}
          />
        </div>
      </div>
    </section>
  );
}

function SectionHeader() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:border-purple-700/40 dark:bg-purple-900/30 dark:text-purple-300">
        {t("landing.sectionSecurity.badge")}
      </span>
      <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
        {t("landing.sectionSecurity.title")}
      </h2>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
        {t("landing.sectionSecurity.subtitle")}
      </p>
    </div>
  );
}
