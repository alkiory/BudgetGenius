import dashboardMobile from "@presentation/assets/dashboard_mobile.png";
import presentationDashboard from "@presentation/assets/presentation_dashboard.png";
import { useTranslation } from "react-i18next";
import { MockupFrame } from "./mockup-frame";

/**
 * "Overview" / Showcase section.
 * Two phones staggered diagonally over a soft purple-to-fuchsia radial
 * gradient — mirrors Vaulta's "intersecting device" composition without
 * replicating the bank's "card / account" imagery.
 */
export function Showcase() {
  const { t } = useTranslation();
  return (
    <section className="relative isolate overflow-x-clip bg-background py-20 lg:py-24">
      <div className="container mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:border-purple-700/40 dark:bg-purple-900/30 dark:text-purple-300">
            {t("landing.sectionShowcase.badge")}
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            {t("landing.sectionShowcase.title")}
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            {t("landing.sectionShowcase.subtitle")}
          </p>
        </div>

        <div className="relative mx-auto flex items-center justify-center">
          {/* Soft gradient ground (radial) */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 rounded-3xl bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-300/40 via-fuchsia-200/20 to-transparent blur-2xl dark:from-purple-700/30 dark:via-fuchsia-700/15"
          />

          <div className="grid grid-cols-1 items-center gap-10 px-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            {/* left phone — main dashboard view, tilted left */}
            <div className="relative flex justify-center md:justify-end -mb-12 md:mb-0">
              <MockupFrame
                variant="mobile"
                src={dashboardMobile}
                alt={t("landing.dashboardTitle")}
                rotate={-8}
                scale={1.05}
              />
            </div>
            {/* right dashboard mockup */}
            <div className="relative flex justify-center md:justify-start">
              <div className="w-full max-w-md rounded-xl border border-slate-200/60 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                <img
                  src={presentationDashboard}
                  alt={t("landing.dashboardTitle")}
                  className="block w-full rounded-xl"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
