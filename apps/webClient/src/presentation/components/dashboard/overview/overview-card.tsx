import { useLocale } from "@adapters/hooks/useLocale";
import { ArrowDownRight, ArrowUpRight, DollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";

interface OverviewCardProps {
  balance: string;
  income: string;
  expenses: string;
  period: Date;
}

export function OverviewCard({
  balance,
  income,
  expenses,
  period,
}: OverviewCardProps) {
  const { t } = useTranslation();
  // `period` sometimes arrives as a string timestamp from the API
  // (e.g. `overview?.period`); `new Date(x)` tolerates both Date
  // instances and ISO strings, so we just normalize here.
  const periodDate = new Date(period);
  // Hook reads `state.userSettings.settings.locale` (BCP-47 tag) via
  // `useSelector`, with `"en-US"` fallback while the slice still
  // holds `locale: ""` (the initial state per `settingsSlice.ts`).
  // Using the user’s chosen locale here replaces the previous
  // `periodDate.toDateString()` — `toDateString()` ignores locale
  // entirely and always emits the English `"Thu Jun 28 2026"` form,
  // which is the root cause of the Spanish-UI-but-English-date
  // mismatch on the dashboard.
  const locale = useLocale();

  return (
    <section>
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {t("dashboard.overview")}
        </h2>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {periodDate.toLocaleDateString(locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label={t("common.balance")}
          value={balance}
          icon={DollarSign}
          tone="teal"
        />
        <StatCard
          label={t("dashboard.summaryIncome")}
          value={income}
          icon={ArrowUpRight}
          tone="emerald"
        />
        <StatCard
          label={t("dashboard.totalExpenses")}
          value={expenses}
          icon={ArrowDownRight}
          tone="rose"
        />
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone: "teal" | "emerald" | "rose";
}) {
  const tones = {
    teal: {
      tile: "border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-300",
      value: "text-slate-900 dark:text-white",
      bar: "from-transparent via-teal-400/80 to-transparent",
      glow: "group-hover:shadow-[0_0_45px_-18px_rgb(45_212_191_/_0.75)]",
    },
    emerald: {
      tile: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
      value: "text-emerald-600 dark:text-emerald-300",
      bar: "from-transparent via-emerald-400/80 to-transparent",
      glow: "group-hover:shadow-[0_0_45px_-18px_rgb(52_211_153_/_0.65)]",
    },
    rose: {
      tile: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300",
      value: "text-rose-600 dark:text-rose-300",
      bar: "from-transparent via-rose-400/80 to-transparent",
      glow: "group-hover:shadow-[0_0_45px_-18px_rgb(251_113_133_/_0.55)]",
    },
  }[tone];

  return (
    <div
      className={`group glass-panel hover-glow relative overflow-hidden rounded-xl p-5 ${tones.glow}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-x-6 top-0 h-px bg-gradient-to-r opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${tones.bar}`}
      />
      <div className="flex items-start justify-between">
        <span
          className={`grid h-10 w-10 place-items-center rounded-lg border ${tones.tile}`}
        >
          <Icon className="h-[1.1rem] w-[1.1rem]" />
        </span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
          {label}
        </span>
      </div>
      <p
        className={`mt-5 text-2xl font-semibold tracking-tight ${tones.value}`}
      >
        {value}
      </p>
    </div>
  );
}
