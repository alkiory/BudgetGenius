import type { RootState } from "@adapters/store/rootStore";
import dashboardMobile from "@presentation/assets/dashboard_mobile.png";
import { Button } from "@presentation/components/ui/button";
import { RoutePaths } from "@presentation/utils/routes";
import { ArrowRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router";
import { MockupFrame } from "./mockup-frame";

/**
 * Top-of-landing hero.
 * - 2-col grid: text left, phone mockup right (collapses on < lg).
 * - Headline uses Playfair Display serif-italic for accent words
 *   (see landing.heroTitleAccent[12] in i18n).
 * - Primary CTA flips to "Go to dashboard" when the user is authed
 *   (leaf-selector per knowledge.md §6.8 to avoid the react-redux 9
 *   combined-destructure render bug).
 */
export function Hero() {
  const { t } = useTranslation();
  const user = useSelector((s: RootState) => s.auth.user);
  const isAuthed = user !== null;

  const primaryHref = isAuthed
    ? `${RoutePaths.App}/${RoutePaths.Dashboard}`
    : `${RoutePaths.Auth}/${RoutePaths.Signup}`;
  const primaryLabel = isAuthed
    ? t("landing.goToDashboard")
    : t("landing.getStarted");

  return (
    <section className="relative isolate overflow-x-clip bg-gradient-to-br from-purple-50 via-white to-fuchsia-50 py-16 dark:from-purple-950 dark:via-slate-900 dark:to-slate-900 sm:py-20 lg:py-24">
      {/* Radial glow blobs behind the phone */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 -z-10 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-fuchsia-400/40 via-purple-400/15 to-transparent blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-40 -z-10 h-[300px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-300/30 via-transparent to-transparent blur-2xl"
      />

      <div className="container mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
        {/* LEFT — text column */}
        <div>
          {/* Social proof pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200/60 bg-white/70 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm dark:border-purple-700/40 dark:bg-slate-900/70">
            <Sparkles
              className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400"
              aria-hidden="true"
            />
            <span className="text-slate-700 dark:text-slate-300">
              {t("landing.heroBadgeSub")}
            </span>
          </div>

          {/* Headline with serif-italic accents */}
          <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight text-slate-900 dark:text-white sm:text-6xl lg:text-7xl">
            {t("landing.heroTitleLead")}{" "}
            <span className="font-serif italic text-purple-700 dark:text-purple-300">
              {t("landing.heroTitleAccent1")}
            </span>
            {t("landing.heroTitleBody")}{" "}
            <span className="font-serif italic text-purple-700 dark:text-purple-300">
              {t("landing.heroTitleAccent2")}
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            {t("landing.heroSubtitle")}
          </p>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-lg shadow-purple-500/30 transition-transform hover:scale-105 hover:from-purple-700 hover:to-violet-600"
            >
              <Link to={primaryHref} className="flex items-center">
                {primaryLabel}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-slate-300 bg-white/50 backdrop-blur-sm transition-transform hover:scale-105 dark:border-slate-700 dark:bg-slate-900/50"
            >
              <a href="#how-it-works">{t("landing.seeHowItWorks")}</a>
            </Button>
          </div>

          {/* Secondary trust chip — reinforces "free" beneath the CTAs */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-emerald-100 px-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              {t("landing.heroBadge")}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t("landing.noCreditCard")}
            </span>
          </div>
        </div>

        {/* RIGHT — tilted phone mockup */}
        <div className="relative flex justify-center lg:justify-end">
          <MockupFrame
            variant="mobile"
            src={dashboardMobile}
            alt={t("landing.dashboardTitle")}
            rotate={-6}
            loading="eager"
          />
        </div>
      </div>
    </section>
  );
}
