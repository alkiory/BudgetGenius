import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const FAQ_KEYS = [
  "reallyFree",
  "dataStorage",
  "mobileApp",
  "bankConnection",
  "language",
  "export",
] as const;

/**
 * FAQ section. Custom React state-based accordion (no Radix / no new
 * dependency) — single-open-at-a-time, plus/minus icons in a circular
 * button to the right, active item gets the purple gradient + white text
 * treatment so the active row reads as a confident "this answered it".
 */
export function Faq() {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      className="relative isolate overflow-x-clip bg-background py-20 lg:py-24"
    >
      <div className="container mx-auto max-w-4xl px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:border-purple-700/40 dark:bg-purple-900/30 dark:text-purple-300">
            {t("landing.sectionFaq.badge")}
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            {t("landing.sectionFaq.title")}
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            {t("landing.sectionFaq.subtitle")}
          </p>
        </div>

        <div className="divide-y divide-transparent">
          {FAQ_KEYS.map((key, idx) => {
            const isOpen = openIndex === idx;
            const question = t(`landing.sectionFaq.items.${key}.question`);
            const answer = t(`landing.sectionFaq.items.${key}.answer`);
            return (
              <div
                key={key}
                className={`mb-3 overflow-hidden rounded-2xl border transition-all duration-300 ${
                  isOpen
                    ? "border-transparent bg-gradient-to-br from-purple-700 via-violet-600 to-fuchsia-600 shadow-xl shadow-purple-500/30"
                    : "border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${key}`}
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className={`flex w-full items-center justify-between gap-4 p-5 text-left font-semibold transition-colors ${
                    isOpen
                      ? "text-white"
                      : "text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-slate-800/50"
                  }`}
                >
                  <span className="text-base sm:text-lg">{question}</span>
                  <span
                    className={`grid h-9 w-9 flex-none place-items-center rounded-full transition-colors ${
                      isOpen
                        ? "bg-white/20 text-white"
                        : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                    }`}
                    aria-hidden="true"
                  >
                    {isOpen ? (
                      <Minus className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </span>
                </button>
                <div
                  id={`faq-panel-${key}`}
                  className={`grid overflow-hidden px-5 text-sm leading-relaxed transition-all duration-300 sm:text-base ${
                    isOpen
                      ? "grid-rows-[1fr] pb-5 pt-0 text-white/90"
                      : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">{answer}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
