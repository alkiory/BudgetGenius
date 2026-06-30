import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Sparkles,
  Target,
} from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Three-card features section.
 * - Track (paper): white card, embedded transaction-list preview.
 * - Finny (highlighted): purple-to-violet gradient, white text, chat preview.
 * - Goals (paper): white card, goal-progress bars preview.
 */
export function Features() {
  const { t } = useTranslation();
  return (
    <section className="relative isolate overflow-x-clip bg-background py-20 lg:py-24">
      <div className="container mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:border-purple-700/40 dark:bg-purple-900/30 dark:text-purple-300">
            {t("landing.sectionFeatures.badge")}
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            {t("landing.sectionFeatures.title")}
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            {t("landing.sectionFeatures.subtitle")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* ── Track (paper) ── */}
          <article className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              <BarChart3 className="h-6 w-6" aria-hidden="true" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t("landing.sectionFeatures.items.track.eyebrow")}
            </span>
            <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
              {t("landing.sectionFeatures.items.track.title")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t("landing.sectionFeatures.items.track.description")}
            </p>
            {/* Mini preview — transaction list */}
            <div className="mt-6 space-y-2">
              <PreviewRow
                tone="income"
                icon={<ArrowDownRight className="h-3.5 w-3.5" />}
                name="Salary"
                delta="+$2,800"
              />
              <PreviewRow
                tone="expense"
                icon={<ArrowUpRight className="h-3.5 w-3.5" />}
                name="Groceries"
                delta="-$120"
              />
              <PreviewRow
                tone="expense"
                icon={<ArrowUpRight className="h-3.5 w-3.5" />}
                name="Coffee"
                delta="-$4.50"
              />
            </div>
          </article>

          {/* ── Finny (HIGHLIGHTED) ── */}
          <article className="relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-purple-700 via-violet-600 to-fuchsia-600 p-6 text-white shadow-xl shadow-purple-500/40">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/15 blur-3xl"
            />
            <div className="relative">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Sparkles className="h-6 w-6" aria-hidden="true" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-white/80">
                {t("landing.sectionFeatures.items.finny.eyebrow")}
              </span>
              <h3 className="mt-1 text-xl font-semibold leading-snug">
                {t("landing.sectionFeatures.items.finny.title")}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/90">
                {t("landing.sectionFeatures.items.finny.description")}
              </p>
              {/* Chat preview */}
              <div className="mt-6 space-y-2">
                <div className="rounded-xl bg-white/15 p-3 text-sm leading-relaxed backdrop-blur-sm">
                  <span className="font-semibold">Finny</span>
                  <span aria-hidden="true"> · </span>
                  {t("landing.sectionFeatures.finnyChat.tap")}
                </div>
                <div className="rounded-xl bg-gradient-to-r from-violet-500/70 to-fuchsia-500/70 p-3 text-sm font-medium leading-relaxed">
                  {t("landing.sectionFeatures.finnyChat.reply")}
                </div>
              </div>
            </div>
          </article>

          {/* ── Goals (paper) ── */}
          <article className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              <Target className="h-6 w-6" aria-hidden="true" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t("landing.sectionFeatures.items.goals.eyebrow")}
            </span>
            <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
              {t("landing.sectionFeatures.items.goals.title")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t("landing.sectionFeatures.items.goals.description")}
            </p>
            {/* Goal progress bars */}
            <div className="mt-6 space-y-3">
              <GoalBar label="Emergency Fund" percent={80} tone="violet" />
              <GoalBar label="Vacation" percent={45} tone="fuchsia" />
              <GoalBar label="New Laptop" percent={22} tone="purple" />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function PreviewRow({
  icon,
  name,
  delta,
  tone,
}: {
  icon: React.ReactNode;
  name: string;
  delta: string;
  tone: "income" | "expense";
}) {
  const toneClass =
    tone === "income"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2">
        <span
          className={`grid h-6 w-6 place-items-center rounded-md bg-white text-slate-500 dark:bg-slate-900 ${toneClass}`}
        >
          {icon}
        </span>
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {name}
        </span>
      </div>
      <span className={`font-mono font-semibold ${toneClass}`}>{delta}</span>
    </div>
  );
}

function GoalBar({
  label,
  percent,
  tone,
}: {
  label: string;
  percent: number;
  tone: "violet" | "fuchsia" | "purple";
}) {
  const fill =
    tone === "violet"
      ? "from-violet-500 to-violet-400"
      : tone === "fuchsia"
      ? "from-fuchsia-500 to-fuchsia-400"
      : "from-purple-500 to-purple-400";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {label}
        </span>
        <span className="font-mono font-semibold text-slate-500 dark:text-slate-400">
          {percent}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${fill}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
