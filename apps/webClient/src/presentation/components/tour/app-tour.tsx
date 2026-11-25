import { useGetSettings } from "@adapters/query/userQuery";
import {
  APP_PATHS,
  landingHref,
  RoutePaths,
} from "@presentation/utils/routes";
import {
  consumeOnboardingJustFinished,
  hasPendingOnboardingTour,
  markTourVersionSeen,
  readSeenTourVersion,
} from "@presentation/utils/appTour";
import { driver, type DriveStep, type PopoverDOM } from "driver.js";
import "driver.js/dist/driver.css";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

/**
 * First-run product tour (driver.js).
 *
 * New users: the onboarding wizard drops a session flag before redirecting,
 * so the dashboard opens with a guided walk through the sidebar, quick add,
 * Finny and the changelog.
 *
 * Existing users: after every build (`__APP_VERSION__` changes) the first
 * dashboard visit shows a short "what's new" tour instead. Either way the
 * build version is stamped in localStorage, so it never repeats until the
 * next deploy.
 *
 * The tour is deliberately non-blocking: closing it (Esc, backdrop or the
 * X button) counts as seen, and reduced-motion users get no animation.
 */

/** Targets are skipped when off-canvas (mobile sidebar) or missing. */
function isReachable(selector: string): boolean {
  const element = document.querySelector(selector);
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.right > 0 &&
    rect.left < window.innerWidth
  );
}

/**
 * Adds a real link to the popover. A tour step can point at a UI element but
 * cannot click it for the user; release notes need an actual anchor that
 * opens the changelog in a new tab (and works with middle-click / keyboard).
 */
function withChangelogLink(step: DriveStep, label: string): DriveStep {
  return {
    ...step,
    popover: {
      ...step.popover,
      onPopoverRender: (popover: PopoverDOM) => {
        // Popover re-renders (resize, theme changes) must not stack copies.
        popover.description
          .querySelector(".bg-tour__changelog-link")
          ?.remove();
        const link = document.createElement("a");
        link.className = "bg-tour__changelog-link";
        link.href = landingHref(RoutePaths.Changelog);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = label;
        popover.description.appendChild(link);
      },
    },
  };
}

export function AppTour() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useGetSettings();
  const { pathname } = useLocation();
  const launched = useRef(false);
  const scheduled = useRef(false);
  const timerRef = useRef<number | null>(null);
  // i18n starts in the detected language and switches to the saved locale
  // once settings resolve. Reading `t` from a ref at launch time keeps the
  // tour in the same language as the dashboard it highlights.
  const tRef = useRef(t);

  const hasCompletedOnboarding = settings?.hasCompletedOnboarding === true;

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // The effect below must schedule at most once per mount: consuming the
  // wizard flag early meant any re-render cleared the pending timer and the
  // next pass saw "no flag, first visit" — silently stamping the build and
  // never showing the tour. The decision is now latched and the timer is
  // only cancelled on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
        // StrictMode's mount → cleanup → mount cycle (and any real
        // unmount before the delay elapses) must be able to schedule
        // again; the wizard flag is still untouched at this point.
        scheduled.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (launched.current || scheduled.current) return;
    if (isLoading || !hasCompletedOnboarding) return;
    if (pathname !== APP_PATHS.dashboard) return;

    const isNewUser = hasPendingOnboardingTour();
    // Existing users (including a browser with nothing stored, e.g. the
    // first rollout of this feature or a new device) get the release
    // notice once per build. Users coming straight from the wizard get
    // the full product tour instead, which stamps the same version.
    if (!isNewUser && readSeenTourVersion() === __APP_VERSION__) {
      scheduled.current = true;
      return;
    }

    scheduled.current = true;
    const finish = () => markTourVersionSeen(__APP_VERSION__);

    // Let the dashboard paint its chrome and the Finny portal before
    // measuring any target.
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (launched.current) return;
      if (window.location.pathname !== APP_PATHS.dashboard) {
        // The user moved on before the tour could start; retry the next
        // time the dashboard opens instead of marking the build as seen.
        scheduled.current = false;
        return;
      }
      launched.current = true;
      if (isNewUser) consumeOnboardingJustFinished();
      const tr = tRef.current;

      const steps: DriveStep[] = isNewUser
        ? [
            {
              popover: {
                title: tr("tour.onboarding.welcomeTitle"),
                description: tr("tour.onboarding.welcomeBody"),
              },
            },
            {
              element: '[data-tour="sidebar-nav"]',
              popover: {
                title: tr("tour.onboarding.navTitle"),
                description: tr("tour.onboarding.navBody"),
                side: "right",
                align: "start",
              },
            },
            {
              element: '[data-tour="quick-add"]',
              popover: {
                title: tr("tour.onboarding.addTitle"),
                description: tr("tour.onboarding.addBody"),
                side: "bottom",
                align: "end",
              },
            },
            {
              element: '[data-tour="finny"]',
              popover: {
                title: tr("tour.onboarding.finnyTitle"),
                description: tr("tour.onboarding.finnyBody"),
                side: "left",
                align: "end",
              },
            },
            withChangelogLink(
              {
                element: '[data-tour="version-badge"]',
                popover: {
                  title: tr("tour.onboarding.releaseTitle"),
                  description: tr("tour.onboarding.releaseBody"),
                  side: "right",
                  align: "end",
                },
              },
              tr("tour.changelogCta"),
            ),
          ]
        : [
            {
              popover: {
                title: tr("tour.whatsNew.title", { version: __APP_VERSION__ }),
                description: tr("tour.whatsNew.body"),
              },
            },
            withChangelogLink(
              {
                element: '[data-tour="version-badge"]',
                popover: {
                  title: tr("tour.whatsNew.changelogTitle"),
                  description: tr("tour.whatsNew.changelogBody"),
                  side: "right",
                  align: "end",
                },
              },
              tr("tour.changelogCta"),
            ),
          ];

      const reachable = steps.filter(
        (step) =>
          typeof step.element !== "string" || isReachable(step.element),
      );

      try {
        const tour = driver({
          steps: reachable,
          showProgress: true,
          progressText: tr("tour.progress", {
            current: "{{current}}",
            total: "{{total}}",
          }),
          nextBtnText: tr("tour.next"),
          prevBtnText: tr("tour.previous"),
          doneBtnText: tr("tour.done"),
          allowClose: true,
          smoothScroll: true,
          stagePadding: 8,
          stageRadius: 14,
          overlayColor: "#04070f",
          overlayOpacity: 0.74,
          popoverClass: "bg-tour",
          animate: !window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches,
          onDestroyed: finish,
        });

        tour.drive();
      } catch {
        // A broken tour must never block the app.
        finish();
      }
    }, 700);
  }, [hasCompletedOnboarding, isLoading, pathname, t]);

  return null;
}
