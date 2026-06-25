/** Build version badge shown in the sidebar footer.
 *
 * `__APP_VERSION__` is injected at build time by Vite's `define` (see
 * vite.config.ts). In CI it comes from `git describe`; in local dev it
 * falls back to `package.json version + "-dev"`.
 */

export function VersionBadge() {
  return (
    <span
      title={`Build: ${__APP_VERSION__}`}
      className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-400 dark:bg-slate-800 dark:text-slate-500"
    >
      v{__APP_VERSION__}
    </span>
  );
}
