/**
 * Platform detection — legacy entry point.
 *
 * @deprecated Import `isNativePlatform` from `@infrastructure/native`
 *   instead. This file is kept as a re-export so the 22+ existing consumers
 *   (`@adapters/auth/*`, login/signup, splash RootRoute) keep working
 *   without touching their import statements. Both paths resolve to the
 *   exact same memoized module reference at runtime.
 *
 * The detection logic itself has moved to `@infrastructure/native` and is
 * now backed by a module-scope lazy cache: the 3-tier Capacitor check
 * runs exactly once per browser session / HMR reload.
 *
 * NB: We import-then-re-export (instead of `export {...} from`) so the
 * JSDoc `@deprecated` tag attaches to an entity declaration and surfaces
 * in TypeScript/IDE warnings for callers still on the legacy path.
 */

import { isNativePlatform as _isNativePlatform } from "@infrastructure/native";

/** @deprecated Import `isNativePlatform` from `@infrastructure/native` directly. */
export const isNativePlatform = _isNativePlatform;
