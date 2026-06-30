import { useTranslation } from "react-i18next";

/**
 * Public `/changelog` page — BudgetGenius release timeline.
 *
 * Renders a vertical timeline of all releases with a numbered gradient dot,
 * version pill, locale-aware date, title, and a 1–2 sentence body. Content
 * is fully i18n-driven via `landing.changelog.*`; adding a new release is
 * one new entry in both:
 *  - this file's local `entries` constant (literal `t(...)` calls so the
 *    i18next CI extractor — if added later — sees every key statically), and
 *  - the matching `landing.changelog.entries.<id>.{title,body}` block in
 *    `en.json` + `es.json`.
 *
 * Layout notes:
 *  - The vertical line + numbered dot share the same `left-3.5` axis with
 *    negative margin offsets (`-ml-3.5` / `-ml-px`) so their centers
 *    coincide exactly at li_x=14 even though the dot is 28×28 and the line
 *    is `w-0.5` (2px). No `border-l` hack, no per-cell grid math.
 *  - Each `<li>` has its own line; we skip the line on the last entry so
 *    the bottom of the timeline doesn't trail off into empty space.
 *  - `Intl.DateTimeFormat(i18n.language, …)` re-constructs on every render
 *    (cheap: it caches locale data internally) so locale switches at
 *    runtime re-format the dates immediately.
 */
export default function ChangelogPage() {
  const { t, i18n } = useTranslation();

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Entries are constructed inside the component so `t()` resolves each
  // title/body against the current language on every render and so each
  // `t("…")` is a *literal* key string (the i18next scanner — used in CI
  // for translation audits — only detects literal calls reliably).
  const entries = [
    {
      version: "v1.4",
      dateIso: "2026-06-27",
      title: t("landing.changelog.entries.moneyEntry.title"),
      body: t("landing.changelog.entries.moneyEntry.body"),
    },
    {
      version: "v1.4",
      dateIso: "2026-06-27",
      title: t("landing.changelog.entries.multiCurrency.title"),
      body: t("landing.changelog.entries.multiCurrency.body"),
    },
    {
      version: "v1.3",
      dateIso: "2026-06-26",
      title: t("landing.changelog.entries.mobileSignin.title"),
      body: t("landing.changelog.entries.mobileSignin.body"),
    },
    {
      version: "v1.2",
      dateIso: "2026-06-26",
      title: t("landing.changelog.entries.googleSignin.title"),
      body: t("landing.changelog.entries.googleSignin.body"),
    },
    {
      version: "v1.0",
      dateIso: "2026-06-25",
      title: t("landing.changelog.entries.launched.title"),
      body: t("landing.changelog.entries.launched.body"),
    },
  ];

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
          {entries.map((entry, idx) => {
            const isLast = idx === entries.length - 1;
            return (
              <li key={entry.title} className="relative pl-12">
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-7 -ml-px h-12 w-0.5 bg-purple-200 dark:bg-purple-700/40"
                  />
                )}
                <span
                  aria-hidden="true"
                  className="absolute left-3.5 top-0 -ml-3.5 grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-purple-600 via-violet-600 to-fuchsia-600 text-xs font-bold text-white shadow-md ring-4 ring-white dark:ring-slate-900"
                >
                  {idx + 1}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-700 dark:border-purple-700/40 dark:bg-purple-900/30 dark:text-purple-300">
                    {entry.version}
                  </span>
                  <time
                    dateTime={entry.dateIso}
                    className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400"
                  >
                    {dateFormatter.format(new Date(entry.dateIso))}
                  </time>
                </div>
                <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                  {entry.title}
                </h2>
                <p className="mt-2 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  {entry.body}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
