/** Build version badge shown in the sidebar footer.
 *
 * `__APP_VERSION__` is injected at build time by Vite's `define` (see
 * vite.config.ts). In CI it comes from `git describe`; in local dev it
 * falls back to `package.json version + "-dev"`.
 *
 * It doubles as the changelog entry point: the tour points here, so the
 * badge must actually be clickable. It opens in a new tab to keep the
 * dashboard session untouched.
 */

import { landingHref, RoutePaths } from "@presentation/utils/routes";

export function VersionBadge() {
  return (
    <a
      href={landingHref(RoutePaths.Changelog)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Build: ${__APP_VERSION__} — open changelog`}
      className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-400 transition-colors hover:text-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 dark:bg-slate-800 dark:text-slate-500 dark:hover:text-teal-300"
    >
      v{__APP_VERSION__}
    </a>
  );
}
