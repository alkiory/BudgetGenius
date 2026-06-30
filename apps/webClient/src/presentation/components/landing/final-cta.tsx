import type { RootState } from "@adapters/store/rootStore";
import dashboardMobile from "@presentation/assets/dashboard_mobile.png";
import { Button } from "@presentation/components/ui/button";
import { RoutePaths } from "@presentation/utils/routes";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router";

import { MockupFrame } from "./mockup-frame";

/**
 * Final-CTA banner section.
 * Wide purple-gradient rounded card: headline + dual CTAs on the left,
 * two phones tilted and clipped to spill off the right edge — Vaulta-style
 * "phones sticking out of a banner" composition.
 */
export function FinalCta() {
  const { t } = useTranslation();
  const user = useSelector((s: RootState) => s.auth.user);
  const isAuthed = user !== null;

  const primaryHref = isAuthed
    ? `${RoutePaths.App}/${RoutePaths.Dashboard}`
    : `${RoutePaths.Auth}/${RoutePaths.Signup}`;
  const primaryLabel = isAuthed
    ? t("landing.goToDashboard")
    : t("landing.getStarted");
  const secondaryHref = `${RoutePaths.Auth}/${RoutePaths.Login}`;
  const secondaryLabel = t("auth.logIn");

  return (
    <section className="overflow-x-clip bg-background py-12 lg:py-20">
      <div className="container mx-auto max-w-7xl px-6">
        <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-purple-700 via-violet-600 to-fuchsia-600 px-8 py-14 shadow-2xl shadow-purple-500/30 sm:px-12 lg:py-16">
          {/* Decorative blur layers */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-white/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-40 -left-32 h-80 w-80 rounded-full bg-fuchsia-400/40 blur-3xl"
          />

          <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-12">
            {/* LEFT — copy + CTAs */}
            <div className="text-white">
              <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
                {t("landing.sectionFinalCta.badge")}
              </span>
              <h2 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
                {t("landing.sectionFinalCta.title")}
              </h2>
              <p className="mt-4 max-w-xl text-lg text-white/90">
                {t("landing.sectionFinalCta.subtitle")}
              </p>
              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  className="bg-stale-300 text-purple-700 shadow-lg hover:scale-105 hover:bg-purple-50"
                >
                  <Link to={primaryHref} className="flex items-center">
                    {primaryLabel}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-white bg-white/10 hover:bg-white/20"
                >
                  <Link to={secondaryHref}>{secondaryLabel}</Link>
                </Button>
              </div>
              <p className="mt-5 text-sm text-white/80">
                {t("landing.noCreditCard")}
              </p>
            </div>

            {/* RIGHT — phones spilling out */}
            <div className="relative hidden min-h-[24rem] lg:block">
              <div className="absolute -right-12 top-0">
                <MockupFrame
                  variant="mobile"
                  src={dashboardMobile}
                  alt={t("landing.dashboardTitle")}
                  rotate={-10}
                  scale={1.0}
                />
              </div>
              <div className="absolute -right-2 top-24">
                <MockupFrame
                  variant="mobile"
                  src={dashboardMobile}
                  alt={t("landing.dashboardTitle")}
                  rotate={8}
                  scale={0.85}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
