import { Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";

/* ────────────────────────────────────────────────────────────────────
 * APK download — Landing section
 *
 * PURPOSE
 *   Conversion-event section that surfaces the native Android APK
 *   to landing-page visitors. Pairs with the parallax mockup
 *   (`MobileAppSection`) one screen up by giving the visitor an
 *   actual "install it" action once they've bought into the
 *   product via Features / HowItWorks / Showcase / Trust / Faq.
 *
 * SOURCE OF TRUTH
 *   The APK URL lives in `VITE_APK_DOWNLOAD_URL` (see `.env.example`).
 *   We deliberately use a fixed-URL strategy instead of querying the
 *   GitHub Releases API at runtime so we don't depend on the
 *   60-requests-per-hour anonymous rate-limit, and so a partial
 *   rollout (env not yet updated) degrades to a "Coming soon"
 *   disabled state instead of pointing to a 404.
 *
 * URL CHANGE PROCEDURE
 *   When `alkiory-bot` (or the operator) ships a new APK:
 *
 *     1. Tag:    git tag -a vX.Y.Z -m "vX.Y.Z"
 *     2. Push:   git push origin main --tags
 *     3. Release on GitHub from that tag, attaching the APK
 *        binary under the EXACT name `BudgetGenius-vX.Y.Z.apk`.
 *     4. Update `VITE_APK_DOWNLOAD_URL` in the active env file
 *        (the URL must match the asset name on the release).
 *     5. Redeploy the web frontend (Vercel / Firebase Hosting).
 *
 * ──────────────────────────────────────────────────────────────────── */

const APK_DOWNLOAD_URL: string = (
  (import.meta.env.VITE_APK_DOWNLOAD_URL as string) ?? ""
).trim();

/**
 * Sentinel tokens that signal "the operator hasn't filled in the URL
 * yet". Any of these in `VITE_APK_DOWNLOAD_URL` flips the button
 * into the disabled "Coming soon" state — better than clicking
 * through to a 404 release asset.
 */
const PLACEHOLDER_TOKENS = [
  "REPLACE_ME",
  "TODO",
  "PLACEHOLDER",
  "YOUR_ORG",
  "YOUR_REPO",
] as const;

function isConfiguredUrl(url: string): boolean {
  if (!url) return false;
  return !PLACEHOLDER_TOKENS.some((token) => url.includes(token));
}

/**
 * `__APP_VERSION__` is injected by `vite.config.ts`. It comes from
 * either the CI step (`git describe --tags`) or the package.json
 * version with `-dev`. The user-visible version caption shows a
 * clean `vMAJOR.MINOR.PATCH` regardless of git-distance suffix.
 */
function normalizeVersion(raw: string): string {
  // Drop leading "v" so we don't accidentally produce "v v1.5.0".
  const withoutV = raw.replace(/^v/i, "").trim();
  // Trim any git-describe suffix ("-3-g4f8e21b", "-dirty", "-dev").
  const [semver] = withoutV.split("-");
  // Fallback if the tag was empty for any reason.
  return semver ? `v${semver}` : "v0.0.0";
}

const APP_VERSION_LABEL = normalizeVersion(__APP_VERSION__);

/* Brand icon: inline Android bugdroid head + antennae. Lucide ships
 * no Android-brand icon, so we render a small, recognisable SVG
 * inline. Tailwind `text-*` on the parent button controls currentColor,
 * so dark-mode and hover variants come along for free. */
function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Antennae */}
      <path
        d="M22 16 L18 6"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M42 16 L46 6"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      {/* Head (dome) */}
      <path d="M6 32 A26 26 0 0 1 58 32 V40 H6 Z" fill="currentColor" />
      {/* Eyes */}
      <circle cx={22} cy={32} r={4} fill="#fff" />
      <circle cx={42} cy={32} r={4} fill="#fff" />
    </svg>
  );
}

/* Subtle downward chevron used inside the button so visitors see
 * an obvious "download" affordance. */
function DownloadChevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 4v14" />
      <path d="M6 14l6 6 6-6" />
    </svg>
  );
}

export function DownloadApp() {
  const { t } = useTranslation();
  const isReady = isConfiguredUrl(APK_DOWNLOAD_URL);

  const versionCaption = `${APP_VERSION_LABEL} · ${t(
    "landing.sectionDownloadApp.versionSuffix",
  )}`;

  return (
    <section
      id="download"
      className="scroll-mt-16 relative isolate overflow-x-clip bg-slate-50 py-20 dark:bg-slate-900/40 lg:py-24"
      aria-label={t("landing.sectionDownloadApp.regionAria")}
    >
      <div className="container mx-auto max-w-3xl px-6 text-center">
        {/* Badge */}
        <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:border-purple-700/40 dark:bg-purple-900/30 dark:text-purple-300">
          {t("landing.sectionDownloadApp.badge")}
        </span>

        {/* Headline */}
        <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
          {t("landing.sectionDownloadApp.title")}
        </h2>

        {/* Subtitle */}
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          {t("landing.sectionDownloadApp.subtitle")}
        </p>

        {/* Primary CTA — button OR disabled state depending on config */}
        <div className="mt-10 flex flex-col items-center gap-3">
          {isReady ? (
            <a
              href={APK_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              /* `download` attribute is a hint to honour the URL's
               * filename when saving. Cross-origin, modern browsers
               * may ignore it, but combined with `target="_blank"` it
               * triggers the OS-level download sheet on every
               * platform we ship to (desktop Chrome / Edge / Firefox
               * + Android Chrome WebView). */
              download
              className="group inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-500 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-purple-500/30 transition-transform hover:scale-[1.02] hover:from-purple-700 hover:to-violet-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-400/40 sm:w-auto sm:min-w-[20rem]"
            >
              <AndroidIcon className="h-7 w-7" />
              <span>{t("landing.sectionDownloadApp.buttonLabel")}</span>
              <DownloadChevron className="h-5 w-5 transition-transform group-hover:translate-y-0.5" />
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex min-h-12 w-full max-w-sm cursor-not-allowed items-center justify-center gap-3 rounded-2xl bg-slate-200 px-8 py-4 text-base font-semibold text-slate-500 shadow-inner dark:bg-slate-800 dark:text-slate-500 sm:w-auto sm:min-w-[20rem]"
            >
              <AndroidIcon className="h-7 w-7 opacity-60" />
              <span>{t("landing.sectionDownloadApp.comingSoonLabel")}</span>
            </button>
          )}

          {/* Version caption — appears under the button in BOTH states so the
              qualitative "what would download" is always visible. */}
          <p className="font-mono text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {versionCaption}
          </p>

          {/* "Install unknown apps" caveat — small, discreet, only
              relevant when the URL is actually wired. */}
          {isReady && (
            <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              <span aria-hidden="true">⚠️</span>{" "}
              {t("landing.sectionDownloadApp.warning")}
            </p>
          )}
        </div>

        {/* iOS — informational only, no link/button. */}
        <div className="mt-12 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/60 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t("landing.sectionDownloadApp.iosSoon")}</span>
        </div>
      </div>
    </section>
  );
}
