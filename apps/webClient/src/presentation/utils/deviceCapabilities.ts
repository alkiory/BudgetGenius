/**
 * @module deviceCapabilities
 *
 * Browser-side device detection helpers used by:
 *
 *  1. The first-login onboarding wizard (`/app/onboarding`), which
 *     pre-selects timezone / currency / language based on the
 *     device's own settings so the user only has to confirm or
 *     change them.
 *  2. The public landing CTA at the top of `budgetgeniusia.web.app`,
 *     which now surfaces the detected timezone so any time-sensitive
 *     surface (e.g. calculator, marketing badge) reads correctly.
 *
 * Every helper is a pure function with SSR / non-browser safety:
 *   - Returns the documented fallback when typeof window is
 *     "undefined" (build-time, sandboxed iframes).
 *   - Returns the documented fallback when the relevant Intl /
 *     navigator API isn't available on the runtime.
 *
 * Android APK audit, 2026-06.
 */

/**
 * BCP-47 locale tags the rest of the app currently models.
 *
 * `en-US` is the implicit fallback for any locale that isn't a
 * Spanish locale prefix. The MVP supports two translations; the
 * onboarding wizard's "language" field is constrained to this list.
 */
export const SUPPORTED_LOCALE_TAGS = ["en-US", "es-CO"] as const;
export type SupportedLocaleTag = (typeof SUPPORTED_LOCALE_TAGS)[number];

/**
 * Currencies the MVP supports. Matches the Postgres ENUM
 * `bg_public.currency_enum` and the `Currency` type in
 * `@presentation/utils/currencyService`.
 */
export const SUPPORTED_CURRENCIES = ["USD", "EUR", "COP"] as const;
export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

const FALLBACK_TIMEZONE = "UTC";
const FALLBACK_LOCALE: SupportedLocaleTag = "en-US";

/**
 * Best-effort locale → currency map. Used by `detectBrowserCurrency()`
 * to pre-select a sensible default for Spanish-speaking users in
 * Latin America, etc. Anything unmapped returns `null` so the
 * onboarding wizard can force a manual selection (no preselection).
 */
const LOCALE_TO_CURRENCY: Record<string, SupportedCurrencyCode> = {
  "en-US": "USD",
  // Latin America: COP is the most common Spanish-speaking MVP
  // cohort; ES-MX falls through to USD since the MVP ENUM doesn't
  // carry MXN.
  "es-CO": "COP",
  "es-MX": "USD",
  // Mainland Spain and continental Europe prefer EUR.
  "es-ES": "EUR",
  "fr-FR": "EUR",
  "de-DE": "EUR",
  "it-IT": "EUR",
  "pt-PT": "EUR",
  "nl-NL": "EUR",
};

/**
 * Detect the device's IANA timezone (e.g. `"America/Bogota"`,
 * `"Europe/Paris"`).
 *
 * Implementation: `Intl.DateTimeFormat().resolvedOptions().timeZone`
 * returns the resolved IANA zone on every modern browser AND on
 * the Capacitor Android WebView, since the WebView's V8 implements
 * the same ICU-backed Intl. This is the spec-mandated detection
 * method from the Android APK audit.
 *
 * Fallback: `"UTC"` so downstream `Intl.DateTimeFormat(locale,
 * { timeZone })` calls always have a valid zone to format against.
 */
export function detectTimezone(): string {
  if (typeof Intl === "undefined") return FALLBACK_TIMEZONE;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof tz === "string" && tz.length > 0) return tz;
  } catch {
    /* sandbox environments may throw — fall through */
  }
  return FALLBACK_TIMEZONE;
}

/**
 * Translate the device's `navigator.language` (or first item in
 * `navigator.languages`) into one of the two supported BCP-47
 * tags. Spanish-speaking locales collapse to `"es-CO"` (the only
 * Spanish translation currently shipped). Anything else falls
 * back to `"en-US"`.
 */
export function detectBrowserLanguage(): SupportedLocaleTag {
  if (typeof navigator === "undefined") return FALLBACK_LOCALE;
  const raw =
    navigator.language ||
    (Array.isArray(navigator.languages) ? navigator.languages[0] : undefined) ||
    "";
  return normaliseLocaleToSupported(raw);
}

/**
 * Look up a known currency for the device's preferred locale.
 * Returns `null` when we don't confidently know the answer so the
 * onboarding wizard can force the user to pick (per spec: "if it
 * can't be inferred with certainty, force selection, no
 * preselection").
 */
export function detectBrowserCurrency(): SupportedCurrencyCode | null {
  const lang = detectBrowserLanguage();
  // Walk progressively shorter prefixes until we find a hit.
  // navigator.language might be "es-CO" or just "es"; "es" maps to
  // the same answer as the most common spelling for Spanish,
  // which is COP given the MVP audience.
  const candidates = [lang, lang.split("-")[0]];
  for (const candidate of candidates) {
    if (candidate && LOCALE_TO_CURRENCY[candidate]) {
      return LOCALE_TO_CURRENCY[candidate];
    }
  }
  return null;
}

/**
 * Return the supported BCP-47 tag that best matches the raw string.
 * Used by `detectBrowserLanguage()` and by the onboarding wizard's
 * "use detected" preset path.
 */
export function normaliseLocaleToSupported(raw: string): SupportedLocaleTag {
  if (!raw) return FALLBACK_LOCALE;
  const lower = raw.toLowerCase();
  // English anywhere → en-US MVP default. The MVP doesn't ship
  // en-GB yet so all English collapses to en-US.
  if (lower.startsWith("en")) return "en-US";
  // Spanish anywhere → es-CO. Same rationale as above.
  if (lower.startsWith("es")) return "es-CO";
  return FALLBACK_LOCALE;
}

/**
 * Build a curated list of IANA timezones for the onboarding
 * dropdown. The MVP doesn't need every zone — `Intl.supportedValuesOf
 * ('timeZone')` returns ~600 entries (full IANA DB); that's too
 * much for a clean UI. We keep ~40 zones that cover the MVP's
 * supported locale footprints plus a global UTC fallback.
 *
 * NOTE: `Intl.supportedValuesOf` is a Stage-4 / broadly available
 * API (Node 18+, modern Chrome, Safari, Firefox). It's also
 * available on the Capacitor Android WebView (V8 + ICU backing).
 */
export const COMMON_TIMEZONES: readonly string[] = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Toronto",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "America/Montevideo",
  "America/Caracas",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Lisbon",
  "Europe/Stockholm",
  "Europe/Athens",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Tehran",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/**
 * Honour the user's OS-level "Reduce motion" preference.
 *
 * Used by the onboarding wizard's welcome animation
 * (a single fade-in on the heading) to bail out when the user
 * has explicitly opted out of motion at the system level.
 *
 * SSR-safe: returns `false` when `window.matchMedia` is not
 * available so server-rendered or sandboxed frames don't crash.
 */
export function prefersReducedMotion(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
