import { RootState } from "@adapters/store/rootStore";
import { useSelector } from "react-redux";

/**
 * Returns the active BCP-47 locale tag for the current user, sourced
 * from the `userSettings` Redux slice (e.g. `"es-CO"`, `"en-US"`).
 *
 * @remarks
 *
 * The slice is hydrated from the React Query `useGetSettings()` result
 * by the dashboard page via `setSettingsAction` — which means the
 * default fallback fires on the very first render before the React
 * Query → Redux sync effect runs. That's the same one-tick fallback
 * every previous inline call site hit, so the behaviour after the
 * extraction is identical.
 *
 * Falls back to `"en-US"` when `settings.locale` is `""` (the initial
 * slice state per `settingsSlice.ts`) or `undefined`, mirroring the
 * `settings?.locale || "en-US"` convention used in
 * `account-settings.tsx`. Use this hook anywhere a locale-aware
 * formatter needs the user's language:
 * `someDate.toLocaleDateString(locale, options)`,
 * `Intl.DateTimeFormat(locale, options)`, `Intl.NumberFormat(...)`,
 * etc.
 *
 * The selector returns a `string`, which is `===`-stable across
 * renders and therefore safe for React 19 / Redux Toolkit 9's
 * `useSyncExternalStore` "getSnapshot should be cached" guard — no
 * new-object-every-render hazard (see `knowledge.md` §6.8 for the
 * sibling pattern this follows).
 *
 * **Sibling hook.** For components that read multiple settings
 * fields (e.g. `currency` + `timezone`) in the same render, prefer
 * `useUserSettings()` from `./useUserSettings`, which collapses the
 * subscription into one `useSelector` call. Stay on `useLocale()`
 * when the component reads locale only — the leaf selector
 * prevents re-renders on unrelated settings mutations.
 *
 * @example
 *   const locale = useLocale();
 *   <time>{startedAt.toLocaleDateString(locale)}</time>;
 */
export function useLocale(): string {
  // Direct leaf selector on `state.userSettings.settings?.locale`
  // (rather than `.userSettings` first + `.settings?.locale`) so the
  // selector's return value is the `string` itself — `===`-stable
  // across renders, no false-positive re-renders on unrelated
  // settings mutations.
  return useSelector(
    (state: RootState) => state.userSettings.settings?.locale || "en-US",
  );
}
