/**
 * Per-install device identity, persisted in `localStorage`.
 *
 * Generated once on first read of the module, then cached at module
 * scope so subsequent reads are free (a no-op `if (cached) return cached`).
 * Survives page reloads because the value is also stored in
 * `localStorage.bgDeviceId`. Survives browser restarts on the same
 * machine too because localStorage is what the user-login session
 * itself uses — so an installed PWA / Capacitor APK and a return visit
 * in the same browser share an id by construction.
 *
 * Used by `apps/webClient/src/infrastructure/api.config.ts` to emit
 * the `X-Device-Id` request header. Backend `apps/api/src/app.module.ts`
 * reads that header in `ThrottlerModule.getTracker()`, so the value
 * must be:
 *   - **stable across reloads** (so the throttle bucket the user
 *     gets is consistent with where their previous requests landed),
 *   - **distinct per install** (so two phones sharing a public IP
 *     don't fold into one throttle bucket — that's the
 *     "v1.3.0 mobile-cookies-persistence" fix's underlying threat
 *     model).
 *
 * Generating strategy:
 *   1. Prefer `crypto.randomUUID()` if available. That ships with
 *      Chrome 92+ (October 2021), so every Android WebView from
 *      2026-era Android 12+ (Chrome ≥ 119) has it.
 *   2. Fallback to a 16-byte hex v4 manual generator from
 *      `crypto.getRandomValues` for older WebViews.
 *   3. If `crypto` itself is undefined (very old browser), fall back
 *      to a time-based + Math.random() pseudo-id. Not cryptographically
 *      strong, but stable enough for per-install throttle-bucket
 *      discrimination.
 */

const STORAGE_KEY = "bgDeviceId";

let cached: string | null = null;

/**
 * Returns a stable per-install device id. The first call performs the
 * crypto-generate + localStorage-write step; subsequent calls are a
 * module-cache lookup.
 */
export function getDeviceId(): string {
  if (cached) return cached;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cached = stored;
      return cached;
    }
  } catch {
    // localStorage may throw in incognito / sandboxed contexts —
    // fall through to the generation step.
  }

  const generated = generateDeviceId();
  cached = generated;

  try {
    window.localStorage.setItem(STORAGE_KEY, generated);
  } catch {
    // Storage write failed — module-scope cache still holds the id
    // so the current session has a stable identifier. Storage write
    // might be available on the next page load.
  }

  return generated;
}

function generateDeviceId(): string {
  // 1. crypto.randomUUID — Chrome 92+, Safari 15.4+, Firefox 95+.
  const cryptoObj =
    typeof window !== "undefined"
      ? (window.crypto as Crypto | undefined)
      : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }

  // 2. crypto.getRandomValues — Chrome 11+, Safari 3.1+, Firefox 21+.
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const arr = new Uint8Array(16);
    cryptoObj.getRandomValues(arr);
    // RFC 4122 v4 — set version + variant bits.
    arr[6] = (arr[6] & 0x0f) | 0x40;
    arr[8] = (arr[8] & 0x3f) | 0x80;
    const hex: string[] = [];
    for (let i = 0; i < arr.length; i++) {
      hex.push(arr[i].toString(16).padStart(2, "0"));
    }
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
      .slice(6, 8)
      .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }

  // 3. Math.random fallback — extremely rare. Still produces a stable
  // per-install id within a session even if storage is unavailable.
  return `bg-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

/**
 * Reset the cached device id (e.g. during testing or when the user
 * explicitly opts out). The next `getDeviceId()` call will generate
 * a fresh one and re-persist it.
 */
export function resetDeviceIdForTesting(): void {
  cached = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore — see generateDeviceId() comment
  }
}
