/**
 * @module native
 * Memoized Capacitor native-platform detection.
 *
 * The 3-tier detection logic (window.Capacitor?.isNativePlatform → URL scheme +
 * Android UA fallback) used to run on every call. With 6 auth strategies +
 * several components + hooks importing it, that meant N invocations per cold
 * start of the webClient bundle. This module caches the result at module
 * scope, so detection runs at most ONCE per module load (i.e., once per
 * browser session in production, once per module HMR in dev, once per Jest
 * worker). After the first call, subsequent calls are O(1) cache hits.
 *
 * Why a module-scope `let` and not `const` evaluated at import time:
 *  - SSR/build-time (`typeof window === "undefined"`) cannot call any
 *    window- or navigator-derived API. A lazy-init cache avoids the throw.
 *  - Same `isNativePlatform()` call signature as the old
 *    `infrastructure/platform.ts` export → all 22+ consumers continue to
 *    work without import changes.
 *  - In React 19 StrictMode dev (double-invoked render), the second render
 *    hits the cache; only the first render does the work.
 *
 * Test isolation: `resetNativePlatformCache()` lets Jest reset the cache
 * between tests so a mutated `window.Capacitor` does not leak across specs.
 */

let cachedIsNative: boolean | undefined = undefined;

/**
 * Evaluates the 3-tier Capacitor native detection on first call, then
 * short-circuits to the cached result. Safe to call from any context
 * (browser, server/build, sandboxed iframe) — internally guards every
 * window/navigator/location read.
 *
 * @returns `true` if the current runtime is a Capacitor native WebView
 *   (Android/iOS); `false` otherwise.
 */
export function isNativePlatform(): boolean {
  if (cachedIsNative !== undefined) {
    return cachedIsNative;
  }

  if (typeof window === "undefined") {
    cachedIsNative = false;
    return cachedIsNative;
  }

  // Tier 1: native bridge injects `window.Capacitor` before userland scripts
  // run. Most reliable when `@capacitor/core` is reachable from the entry.
  try {
    const capacitor = (
      window as unknown as {
        Capacitor?: { isNativePlatform?: () => boolean };
      }
    ).Capacitor;
    if (typeof capacitor?.isNativePlatform === "function") {
      cachedIsNative = capacitor.isNativePlatform();
      return cachedIsNative;
    }
  } catch {
    /* SSR / sandbox where window.Capacitor access throws — fall through */
  }

  // Tier 2/3: Vite may tree-shake `@capacitor/core`, so `window.Capacitor`
  // never appears in the bundle. Detect via URL scheme + Android User-Agent.
  // - Legacy schemes: `capacitor://` / `ionic://` (Capacitor 2/3).
  // - Capacitor 4+ schemes: `https://localhost` (prod `androidScheme: 'https'`)
  //   or `http://localhost` (dev `androidScheme: 'http'`), with an Android UA
  //   heuristic to avoid false-positives on dev browsing https://localhost.
  try {
    const { protocol, hostname } = window.location;

    if (protocol === "capacitor:" || protocol === "ionic:") {
      cachedIsNative = true;
      return cachedIsNative;
    }

    if (
      hostname === "localhost" &&
      (protocol === "https:" || protocol === "http:")
    ) {
      const ua = navigator.userAgent || "";
      if (
        /Android/i.test(ua) ||
        /\bwv\b/i.test(ua) ||
        /; wv\)/i.test(ua)
      ) {
        cachedIsNative = true;
        return cachedIsNative;
      }
    }
  } catch {
    /* ignore — default to web */
  }

  cachedIsNative = false;
  return cachedIsNative;
}

/**
 * Resets the module-scope cache. **Test-only utility.** Call from
 * `afterEach(() => resetNativePlatformCache())` in any Jest spec that
 * mutates `window.Capacitor`, the URL, or the UA between tests so the
 * next call re-runs detection instead of returning a stale result.
 *
 * Production code should never need this — window/location/UA are stable
 * for the lifetime of a page load, and HMR rebinds the module closure.
 */
export function resetNativePlatformCache(): void {
  cachedIsNative = undefined;
}
