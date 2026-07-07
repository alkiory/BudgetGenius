import { Quote } from "lucide-react";
import { useTranslation } from "react-i18next";

type RawTestimonial = {
  id?: string;
  name?: string;
  role?: string;
  rating?: string;
  body?: string;
};

/**
 * Reads `realTestimonials.items` from i18n. When the array is missing or
 * empty (e.g. an English locale with no translations yet), returns
 * `undefined` so the rendering layer can fall back to the placeholder copy.
 */
function readRealTestimonials(
  t: ReturnType<typeof useTranslation>["t"],
): RawTestimonial[] | undefined {
  const raw = t("landing.sectionTestimonials.realTestimonials.items", {
    returnObjects: true,
  });
  return Array.isArray(raw) ? (raw as RawTestimonial[]) : undefined;
}

/**
 * Picks the testimonial for a given card slot. Returns `null` when no real
 * data is available so the calling component can apply the placeholder
 * fallback for that single card (the marquee still needs 6 cards even when
 * we have zero or fewer than 6 unique entries).
 */
function pickTestimonial(
  items: RawTestimonial[] | undefined,
  cardIndex: number,
): RawTestimonial | null {
  if (!items || items.length === 0) return null;
  return items[cardIndex % items.length];
}

function TestimonialCard({
  testimonial,
  cardIndex,
}: {
  testimonial: RawTestimonial | null;
  cardIndex: number;
}) {
  const { t } = useTranslation();
  // `||` (not `??`) so that an accidentally-empty `name`/`body` in the JSON
  // locale entry still falls back to the localized placeholder. Mirrors the
  // contract: when the source field exists but is empty (or null/undefined),
  // we surface the markup-compatible fallback value instead of an empty
  // heading / body paragraph.
  const name =
    testimonial?.name || t("landing.sectionTestimonials.placeholder.name");
  const body =
    testimonial?.body || t("landing.sectionTestimonials.placeholder.body");
  // role / rating may legitimately be absent for testimonials where the user
  // did not provide them (Susan, Patricia). The `<p>` paragraphs always
  // render to preserve the original `<PlaceholderCard>` rhythm and
  // vertical spacing — when the value is missing, the paragraph just
  // renders empty (no fallback copy is invented).
  return (
    <article
      aria-label={`${t("landing.sectionTestimonials.regionAria")} card ${
        cardIndex + 1
      }`}
      className="rounded-2xl border border-dashed border-purple-200 bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-purple-700/40 dark:bg-slate-900/60"
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="grid h-12 w-12 flex-none place-items-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300"
        >
          <Quote className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {name}
          </h3>
          <p className="mt-0.5 text-xs uppercase tracking-wider text-purple-600 dark:text-purple-300">
            {testimonial?.rating}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            {testimonial?.role}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {body}
      </p>
    </article>
  );
}

function MarqueeColumn({
  direction,
  offset,
  items,
}: {
  direction: "down" | "up";
  offset: number;
  items: RawTestimonial[] | undefined;
}) {
  // 6 placeholder cards rendered TWICE so the translateY(-50%) keyframe animation
  // produces a seamless vertical loop. The outer container has overflow-hidden +
  // fixed height so only the visible card row is rendered at a time.
  // `offset` staggers the rotation across the three columns so each column
  // shows a slightly different ordering of the same pool of entries.
  const visibleCards = Array.from({ length: 6 }, (_, i) =>
    pickTestimonial(items, i + offset),
  );
  return (
    <div className="hover-pause relative h-[420px] overflow-hidden rounded-2xl">
      {/* 24 s cycle ≈ 4 s per visible card cycle for 6 cards. Slow enough to
          read; fast enough to feel alive on the landing. Pair with the
          translateY(-50%) keyframe so the duplicated list wraps perfectly. */}
      <div
        className={`flex flex-col gap-4 ${
          direction === "down" ? "animate-marquee-down" : "animate-marquee-up"
        }`}
      >
        {visibleCards.map((data, i) => (
          <TestimonialCard
            key={`visible-${i}`}
            testimonial={data}
            cardIndex={i}
          />
        ))}
        {/* Duplicate set is aria-hidden — the visible batch already announces
            the cards; the duplicates exist only to make the translateY(-50%)
            keyframe loop seamless. */}
        <div aria-hidden="true">
          {visibleCards.map((data, i) => (
            <TestimonialCard
              key={`duplicate-${i}`}
              testimonial={data}
              cardIndex={i + 6}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Testimonials / Trust section. Three columns of cards scroll vertically in
 * opposite directions; entries are pulled from i18n
 * (`landing.sectionTestimonials.realTestimonials.items`) and cycled across
 * the 6 card slots per column with a per-column offset. When the array is
 * empty or missing (e.g. an English locale with no translations shipped yet)
 * every card falls back to the localized placeholder copy so the marquee
 * still has 6 cards to render. The duplicate card list is aria-hidden so
 * screen readers only announce the visible batch.
 */
export function Testimonials() {
  const { t } = useTranslation();
  const items = readRealTestimonials(t);
  return (
    <section className="relative isolate overflow-x-clip bg-gradient-to-b from-white via-purple-50/50 to-white py-20 dark:from-slate-900 dark:via-purple-950/40 dark:to-slate-900 lg:py-24">
      <div className="container mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:border-purple-700/40 dark:bg-purple-900/30 dark:text-purple-300">
            {t("landing.sectionTestimonials.badge")}
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            {t("landing.sectionTestimonials.title")}
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            {t("landing.sectionTestimonials.subtitle")}
          </p>
          <a
            href={t("landing.sectionTestimonials.ctaHref")}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition-transform hover:scale-[1.02] hover:from-purple-700 hover:to-violet-600"
          >
            {t("landing.sectionTestimonials.cta")}
          </a>
        </div>

        <div
          className="grid grid-cols-1 gap-6 md:grid-cols-3"
          aria-label={t("landing.sectionTestimonials.regionAria")}
        >
          <MarqueeColumn direction="down" offset={0} items={items} />
          <MarqueeColumn direction="up" offset={1} items={items} />
          <MarqueeColumn direction="down" offset={2} items={items} />
        </div>
      </div>
    </section>
  );
}
