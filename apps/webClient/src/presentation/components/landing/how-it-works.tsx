import { MessageCircle, PencilLine, Sliders } from "lucide-react";
import { useTranslation } from "react-i18next";

const STEP_ICONS = [
  <PencilLine key="01" aria-hidden="true" />,
  <Sliders key="02" aria-hidden="true" />,
  <MessageCircle key="03" aria-hidden="true" />,
];
const STEP_IDS = ["01", "02", "03"] as const;

/**
 * Three-step "How it works" section.
 * Steps are stacked vertically on small screens and split horizontally on
 * md+ with vertical dividers between each column.
 */
export function HowItWorks() {
  const { t } = useTranslation();
  return (
    <section
      id="how-it-works"
      className="scroll-mt-16 overflow-x-clip bg-slate-50 py-20 dark:bg-slate-900/40 lg:py-24"
    >
      <div className="container mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:border-purple-700/40 dark:bg-purple-900/30 dark:text-purple-300">
            {t("landing.sectionHow.badge")}
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            {t("landing.sectionHow.title")}
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            {t("landing.sectionHow.subtitle")}
          </p>
        </div>

        <div className="grid divide-y divide-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0 dark:divide-slate-800">
          {STEP_IDS.map((id, idx) => (
            <article
              key={id}
              className={`flex flex-col gap-3 px-4 py-8 md:px-8 ${
                idx === 0 ? "md:pl-0" : ""
              } ${idx === STEP_IDS.length - 1 ? "md:pr-0" : ""}`}
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white text-purple-700 shadow-sm ring-1 ring-purple-100 dark:bg-slate-900 dark:text-purple-300 dark:ring-purple-900/40">
                {STEP_ICONS[idx]}
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                {t(`landing.sectionHow.steps.${id}.label`)}
              </span>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t(`landing.sectionHow.steps.${id}.title`)}
              </h3>
              <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
                {t(`landing.sectionHow.steps.${id}.description`)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
