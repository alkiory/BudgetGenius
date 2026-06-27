const STORAGE_KEY = "bgDeviceId";

let cached: string | null = null;

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
