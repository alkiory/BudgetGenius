import { RootState } from "@adapters/store/rootStore";
import { UserSettings } from "@domain/user/userSettings";
import { useSelector } from "react-redux";

/**
 * Returns the full `UserSettings` slice for the current user, or
 * `undefined` if it has not been hydrated yet (initial Redux state
 * before the first `setSettingsAction` dispatch from the hydration
 * site — currently the dashboard page via its React Query
 * `useGetSettings()` + dispatch `useEffect`).
 *
 * @remarks
 *
 * The returned object IS the same `UserSettings` instance kept in
 * the Redux slice. RTK + Immer preserve the reference across
 * renders until a reducer mutates a settings field, so this hook
 * has the same re-render characteristics as a leaf-selector and is
 * safe for React 19's `useSyncExternalStore` snapshot caching
 * (see `knowledge.md` §6.8 for the inline-object-on-useSelector
 * pitfall this deliberately avoids).
 *
 * **When to use this hook vs a leaf selector.**
 *
 * - Use this hook when a component reads **2+ fields** from
 *   `UserSettings` in the same render (e.g. `settings?.currency`
 *   alongside `settings?.timezone`). Calling one
 *   `useUserSettings()` and destructuring is one Redux
 *   subscription, vs two separate selectors that would each
 *   trigger their own `useSyncExternalStore` notification.
 * - Use the dedicated leaf selectors when the component reads
 *   exactly one field and re-rendering on OTHER settings changes
 *   is undesirable:
 *     - `useLocale()` — BCP-47 locale tag (e.g. `"es-CO"`,
 *       `"en-US"`); falls back to `"en-US"` while the slice still
 *       has the empty initial `locale: ""`.
 *
 * Both `useUserSettings()` and `useLocale()` read from the same
 * `state.userSettings.settings` path; they are not in conflict.
 *
 * @example
 *   const settings = useUserSettings();
 *   const currency = settings?.currency ?? "USD";
 *   const timezone = settings?.timezone ?? "UTC";
 */
export function useUserSettings(): UserSettings | undefined {
  return useSelector((state: RootState) => state.userSettings.settings);
}
