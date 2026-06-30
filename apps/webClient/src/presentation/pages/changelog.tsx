import { changelog, type ChangelogEntry } from "@presentation/data/changelog";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/**
 * Public `/changelog` page — BudgetGenius release timeline.
 *
 * Component is fully data-driven from
 * `apps/webClient/src/presentation/data/changelog.ts`. Adding a new
 * release is a single-block edit in that file — no JSX changes, no
 * i18n JSON sync, no extra wiring. See the comment block at the top
 * of that file for the add-an-entry recipe.
 *
 * Why a neutral dot instead of an ordinal number:
 *   The timeline reads in reverse chronological order (newest first).
 *   A `1,2,3,…` numbered counter implies importance, not chronology —
 *   visitors read "1" as "the biggest deal". The dot + vertical line
 *   reads as a continuous timeline; the version pill below does the
 *   actual identification work.
 *
 * Locale-aware date:
 *   `Intl.DateTimeFormat(i18n.language, …)` renders "Jun 30, 2026"
 *   for EN and "30 jun 2026" for ES without any per-entry conditional.
 *   The data file MUST hold an ISO date (`YYYY-MM-DD`) so the page can
 *   hand it to `Intl.DateTimeFormat` fresh.
 */

function pickLocale(rawLang: string): "en" | "es" {
  // i18n returns the active language tag (e.g. "en", "en-US", "es",
  // "es-MX", "es-419"). Treat anything starting with "es" as Spanish,
  // everything else falls back to English.
  return rawLang.toLowerCase().startsWith("es") ? "es" : "en";
}

export default function ChangelogPage() {
  const { t, i18n } = useTranslation();
  const lang = pickLocale(i18n.language);

  // useMemo keyed on the active language so a runtime locale
  // switch re-formats dates immediately, but other re-renders
  // don't reallocate the formatter (React would otherwise construct
  // a fresh Intl.DateTimeFormat on every render — tiny cost, but
  // unnecessary).
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [i18n.language],
  );

  return (
    <section
      aria-label={t("landing.changelog.regionAria")}
      className="relative isolate overflow-x-clip bg-background py-20 lg:py-24"
    >
      <div className="container mx-auto max-w-3xl px-6">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:border-purple-700/40 dark:bg-purple-900/30 dark:text-purple-300">
            {t("landing.changelog.badge")}
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            {t("landing.changelog.title")}
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            {t("landing.changelog.subtitle")}
          </p>
        </div>

        <ol
          aria-label={t("landing.changelog.regionAria")}
          className="list-none space-y-8"
        >
          {changelog.map((entry: ChangelogEntry, idx: number) => {
            const isLast = idx === changelog.length - 1;
            // `${entry.version}-${entry.date}` keeps the key stable across
            // bilingual locale switches without forcing a re-mount.
            const key = `${entry.version}-${entry.date}`;
            return (
              <li key={key} className="relative pl-12">
                {/* Vertical timeline rail. `top-3` aligns the rail's top
                    with the dot's vertical centre (dot top-2 + 5px
                    height-half = y=13). `bottom-0` pins the rail to the
                    bottom edge of the <li>'s padding box, so each
                    non-last entry's rail flows visually into the next
                    entry (the dot's white/dark ring masks the rail
                    behind it). Skipped on the last entry so the
                    timeline doesn't trail into empty space below. */}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-3 bottom-0 w-0.5 -translate-x-1/2 bg-purple-200 dark:bg-purple-700/40"
                  />
                )}
                {/* Neutral timeline dot — small, filled, no number. 10 px
                    centre + ring-4 so it reads as a punctuation mark
                    rather than competing with the version pill below. */}
                <span
                  aria-hidden="true"
                  className="absolute left-3.5 top-2 -ml-[5px] h-[10px] w-[10px] rounded-full bg-purple-500 shadow-sm ring-4 ring-white dark:ring-slate-900"
                />

                <div className="flex flex-wrap items-center gap-3">
                  {entry.highlight && (
                    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                      {t("landing.changelog.newBadge")}
                    </span>
                  )}
                  <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-700 dark:border-purple-700/40 dark:bg-purple-900/30 dark:text-purple-300">
                    v{entry.version}
                  </span>
                  <time
                    dateTime={entry.date}
                    className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400"
                  >
                    {dateFormatter.format(new Date(entry.date))}
                  </time>
                </div>
                <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                  {entry.title[lang]}
                </h2>
                <p className="mt-2 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  {entry.description[lang]}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
