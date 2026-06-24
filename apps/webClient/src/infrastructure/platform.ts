/**
 * Platform detection utility.
 *
 * Detects whether the webClient is running inside a Capacitor native WebView
 * (Android/iOS) versus a regular browser tab. The mobile APK settings in
 * `apps/mobile/capacitor.config.ts` use `androidScheme: 'https'` for production,
 * which gives the WebView an origin of `https://localhost`. The native bridge
 * also injects `window.Capacitor` before any script runs, so the canonical
 * check is `globalThis.Capacitor?.isNativePlatform?.()`.
 *
 * We layer fallbacks because Vite may tree-shake `@capacitor/core` when nothing
 * in the main entry imports it directly, leaving `window.Capacitor` undefined
 * at runtime even though the JS bundle still contains the firebase plugin. The
 * fallback detects the WebView by URL scheme + Android User-Agent, which is
 * reliable enough — Capacitor's documented Android scheme is `https://localhost`
 * (Capacitor 4+) and `capacitor://localhost` (Capacitor 2/3 legacy).
 *
 * `isNative` is intentionally a sync source-of-truth; components can re-read at
 * any time. The async helper `isNativeAsync` is provided for places that want
 * to additionally probe the Capacitor plugin bundle (e.g. before importing the
 * `@capacitor-firebase/authentication` plugin dynamically).
 */

/**
 * Returns true if the current runtime is a Capacitor native WebView.
 *
 * Order of checks (most-reliable → least-reliable):
 * 1. `globalThis.Capacitor?.isNativePlatform?.()` — set by the native bridge.
 * 2. URL is `https://localhost`/`http://localhost` AND the UA looks like an
 *    Android WebView. This catches the case where Vite tree-shakes
 *    `@capacitor/core` so `window.Capacitor` never appears in the bundle.
 * 3. URL is `capacitor://` or `ionic://` (legacy Capacitor 2/3 schemes).
 */
export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    if (typeof capacitor?.isNativePlatform === 'function') {
      return capacitor.isNativePlatform();
    }
  } catch {
    /* SSR / sandbox where window.Capacitor access throws — fall through */
  }

  try {
    const { protocol, hostname } = window.location;

    // Legacy / current Capacitor schemes.
    if (protocol === 'capacitor:' || protocol === 'ionic:') {
      return true;
    }

    // Capacitor 4+ with androidScheme: 'https' (production) OR 'http' (dev).
    // The hostname is always 'localhost'. Pair with an Android User-Agent
    // heuristic so we don't false-positive on a developer browsel
    // accidentally pointed at https://localhost:5173 in the browser.
    if (hostname === 'localhost' && (protocol === 'https:' || protocol === 'http:')) {
      const ua = navigator.userAgent || '';
      if (/Android/i.test(ua) || /\bwv\b/i.test(ua) || /; wv\)/i.test(ua)) {
        return true;
      }
    }
  } catch {
    /* ignore — default to web */
  }

  return false;
}

// (no async helper exposed; use isNativePlatform() synchronously — see header)
