import createBudgetMobile from "@presentation/assets/create_budget_mobile.png";
import startingMobile from "@presentation/assets/starting_mobile.png";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { MockupFrame } from "./mockup-frame";

/**
 * "Your finances in your pocket" — Mobile-First Spotlight section.
 *
 * PERSISTENT SCROLL-DRIVEN PARALLAX (NOT a one-shot reveal):
 * - Two phone screenshots are stacked diagonally. Each layer translates
 *   at a different rate as the section scrolls through the viewport,
 *   creating a subtle depth illusion that keeps responding to scroll
 *   during the entire visibility window — it does NOT freeze once the
 *   section is on screen.
 * - Foreground (`create_budget_mobile`) speed = -0.15.
 * - Background (`starting_mobile`)     speed = -0.05.
 * - IntersectionObserver with 200px rootMargin enables the rAF loop
 *   only while the section is near viewport — saves CPU off-screen.
 * - Listener throttled by requestAnimationFrame; mutations are
 *   `transform: translate3d(...)` only, so the browser composites them
 *   on the GPU (no layout / paint thrash).
 * - Fully respects `prefers-reduced-motion: reduce` — no transforms
 *   applied at all; layers render in their static positions.
 *   Subscribes to the media-query `change` event so a mid-session
 *   OS-level "Reduce Motion" toggle instantly stops/resumes the loop
 *   without remounting the page (e.g. macOS Accessibility panel,
 *   Windows Settings → Ease of Access).
 *
 * No new dependencies introduced; uses native IntersectionObserver +
 * rAF + matchMedia APIs available in every browser we ship to.
 */
export function MobileAppSection() {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const fgRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Honour the OS-level "Reduce Motion" preference.
    //
    // We subscribe to its `change` event so a mid-session toggle
    // (Personality & Accessibility panel on macOS, Settings → Ease of
    // Access on Windows, browser dev tools, etc.) instantly stops or
    // resumes the parallax — without requiring a page remount.
    //
    // State coordination: `prefersReduced` is captured by `tick`, the
    // IO callback, and `onMqChange` via closure, so a single mutation
    // from any of those three paths is visible to the others on the
    // next frame. `active` is also mirrored across IO + mq handler
    // because the loop should only ever run while the section is in
    // the viewport AND motion is allowed.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let rafId = 0;
    let active = false;
    let prefersReduced = mq.matches;

    const resetStatic = () => {
      // Wipe any stale inline transform so layers render in their
      // natural CSS positions (not the last computed parallax offset).
      if (fgRef.current) fgRef.current.style.transform = "";
      if (bgRef.current) bgRef.current.style.transform = "";
    };

    const tick = () => {
      // Defensive cancel: if IO or the mq handler called tick() while a
      // previous rAF was still queued, cancel that prior frame so we
      // never run two parallel tick chains applying the same transform
      // twice per frame.
      cancelAnimationFrame(rafId);
      rafId = 0;
      const section = sectionRef.current;
      if (!active || prefersReduced || !section) return;
      const rect = section.getBoundingClientRect();
      // Positive offset once the section's top edge is at or above the
      // viewport bottom; grows as the user scrolls down. Multiplying by
      // a negative factor makes the layer travel UP visually — i.e.
      // contents inside the section move "up faster than the section"
      // when the user scrolls down, creating depth.
      const offset = window.innerHeight - rect.top;
      if (fgRef.current) {
        fgRef.current.style.transform = `translate3d(0, ${offset * -0.15}px, 0)`;
      }
      if (bgRef.current) {
        bgRef.current.style.transform = `translate3d(0, ${offset * -0.05}px, 0)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        active = entry.isIntersecting;
        if (active && !prefersReduced) {
          tick();
        } else {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      },
      { rootMargin: "200px 0px" },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);

    // Live OS-level toggle handler — flips `prefersReduced` and
    // cancels / resumes the loop in-place.
    const onMqChange = (e: MediaQueryListEvent) => {
      prefersReduced = e.matches;
      if (e.matches) {
        cancelAnimationFrame(rafId);
        rafId = 0;
        resetStatic();
      } else if (active) {
        // Motion re-enabled while section is still on-screen —
        // resume the loop from the current scroll position.
        tick();
      }
    };
    mq.addEventListener("change", onMqChange);

    // Initial mount: if the OS already has motion-reduced on, ensure
    // the layers render in their static positions (the previous code's
    // early-return did the same).
    if (prefersReduced) resetStatic();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
      mq.removeEventListener("change", onMqChange);
      // Reset transforms on unmount so no stale offsets remain
      // attached to the staged DOM nodes after this component unmounts.
      resetStatic();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-x-clip bg-gradient-to-b from-background via-purple-50/40 to-background py-20 dark:via-purple-950/20 lg:py-28"
      aria-label={t("landing.sectionMobileApp.regionAria")}
    >
      <div className="container mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
        {/* LEFT — copy column */}
        <div className="text-center lg:text-left">
          <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:border-purple-700/40 dark:bg-purple-900/30 dark:text-purple-300">
            {t("landing.sectionMobileApp.badge")}
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            {t("landing.sectionMobileApp.title")}
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            {t("landing.sectionMobileApp.subtitle")}
          </p>
        </div>

        {/* RIGHT — parallax stage.
            Stage height sized so two stacked phones (h-[34rem]) have
            room to translate freely without bleeding into neighbours. */}
        <div
          aria-hidden="true"
          className="relative mx-auto h-[42rem] w-full max-w-md lg:h-[46rem]"
        >
          {/* Background phone — top right, slower.
              Rotation reduced to 3° so the rotated bounding box stays
              safely inside the stage on small viewports (320-414px). */}
          <div
            ref={bgRef}
            className="absolute -right-4 top-6 will-change-transform lg:-right-2"
          >
            <MockupFrame
              variant="mobile"
              src={startingMobile}
              alt=""
              rotate={3}
              scale={0.92}
            />
          </div>
          {/* Foreground phone — bottom left, faster */}
          <div
            ref={fgRef}
            className="absolute -bottom-4 -left-4 z-10 will-change-transform lg:-left-2"
          >
            <MockupFrame
              variant="mobile"
              src={createBudgetMobile}
              alt=""
              rotate={-5}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
