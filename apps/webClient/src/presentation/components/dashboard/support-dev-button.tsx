import { Heart } from "@presentation/components/ui/animated-icons";
import { Magnet } from "@presentation/components/ui/magnet";
import { useTranslation } from "react-i18next";

/**
 * Support-the-developer call to action.
 *
 * PayPal Donate accepts the recipient's account email, so no paypal.me
 * handle is needed. One-time donations in the app's default currency.
 */
const DONATION_URL = "https://paypal.me/SergioCampbelldev";

/**
 * Pink, glowing, magnetic CTA in the app header.
 *
 * The glow is a blurred sibling (not a zero-offset box shadow on the pill) so
 * the pill keeps the app's offset-shadow depth; the magnetic pull comes from
 * `<Magnet>` and degrades to a static button on touch / reduced motion.
 */
export function SupportDevButton() {
  const { t } = useTranslation();

  return (
    <Magnet className="group" strength={0.4}>
      <a
        href={DONATION_URL}
        target="_blank"
        rel="noopener noreferrer"
        title={t("support.tooltip")}
        className="relative inline-flex h-8 items-center gap-1.5 rounded-full border border-pink-400/45 bg-pink-500/10 px-2.5 text-xs font-semibold text-pink-600 shadow-[0_0_22px_-8px_rgb(236_72_153_/_0.85)] transition-colors duration-200 hover:border-pink-400/70 hover:bg-pink-500/20 hover:text-pink-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-400 dark:border-pink-400/40 dark:bg-pink-500/10 dark:text-pink-200 dark:hover:bg-pink-500/20 dark:hover:text-pink-100 sm:px-3"
      >
        {/* Glow: sits behind the pill and breathes slowly so the CTA reads as
            "lit" without animating the text itself. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 animate-pulse rounded-full bg-pink-500/35 blur-md"
        />
        <Heart
          className="h-4 w-4 shrink-0 text-pink-500 transition-transform duration-200 group-hover:scale-110 dark:text-pink-300"
          aria-hidden="true"
        />
        <span className="hidden whitespace-nowrap md:inline">
          {t("support.dev")}
        </span>
      </a>
    </Magnet>
  );
}
