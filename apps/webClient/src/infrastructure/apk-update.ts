import { Capacitor, registerPlugin } from "@capacitor/core";
import { isNativePlatform } from "./native";

/**
 * Native side of the in-app update flow (see
 * `apps/mobile/android/.../ApkUpdatePlugin.java`). Android always ends the
 * install with its own confirmation dialog; these calls only remove the browser
 * from the path.
 */
export interface ApkUpdateBridge {
  canInstallPackages(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  installApk(options: { path: string }): Promise<void>;
  notificationsEnabled(): Promise<{ enabled: boolean }>;
  requestNotificationPermission(): Promise<void>;
  notifyUpdate(options: { title: string; body: string }): Promise<void>;
}

export const ApkUpdate = registerPlugin<ApkUpdateBridge>("ApkUpdate");

/**
 * Only Android has this flow (the iOS app has no APK to install). Guarding on
 * the platform keeps the dialog away from iOS builds, where the plugin is not
 * registered at all.
 */
export function supportsInAppUpdates(): boolean {
  if (!isNativePlatform()) return false;
  try {
    return Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

/**
 * Latest published release. It is the same artefact the landing links to, so
 * there is one source of truth for "what is the current APK".
 */
export const LATEST_APK_RELEASE_URL =
  "https://api.github.com/repos/alkiory/BudgetGenius/releases/latest";

export interface ApkRelease {
  /** Semantic version without the `v` prefix, e.g. `1.12.0`. */
  version: string;
  apkUrl: string;
  sizeBytes?: number;
  notes?: string;
}

/** `v1.12.0-dev` → `1.12.0`, so a dev build is not seen as older. */
export function normalizeVersion(raw: string): string {
  return raw.trim().replace(/^v/i, "").split(/[-+]/)[0];
}

function versionParts(raw: string): number[] {
  return normalizeVersion(raw)
    .split(".")
    .map((part) => {
      const parsed = Number.parseInt(part, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
}

/** Negative when `a` is older, positive when newer, 0 when equal. */
export function compareVersions(a: string, b: string): number {
  const left = versionParts(a);
  const right = versionParts(b);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}

export function isNewerVersion(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0;
}

/**
 * Picks the APK out of a GitHub release payload.
 *
 * Only `releases/latest` is queried, which already skips drafts and
 * prereleases, so a beta never reaches a released app.
 */
export function pickApkRelease(payload: unknown): ApkRelease | null {
  if (!payload || typeof payload !== "object") return null;

  const release = payload as {
    tag_name?: unknown;
    body?: unknown;
    assets?: unknown;
  };

  if (typeof release.tag_name !== "string") return null;
  // A prerelease tag must never reach a released app: `releases/latest`
  // already skips them, and stripping the suffix here would turn a beta into
  // "stable". Only a plain `vX.Y.Z` is accepted.
  if (!/^v?\d+(\.\d+)*$/.test(release.tag_name.trim())) return null;
  const version = normalizeVersion(release.tag_name);

  if (!Array.isArray(release.assets)) return null;
  const asset = release.assets.find(
    (candidate) =>
      candidate &&
      typeof candidate === "object" &&
      typeof (candidate as { name?: unknown }).name === "string" &&
      /\.apk$/i.test((candidate as { name: string }).name) &&
      typeof (candidate as { browser_download_url?: unknown })
        .browser_download_url === "string",
  ) as { browser_download_url: string; size?: number } | undefined;

  if (!asset) return null;

  return {
    version,
    apkUrl: asset.browser_download_url,
    sizeBytes: typeof asset.size === "number" ? asset.size : undefined,
    notes: typeof release.body === "string" ? release.body : undefined,
  };
}

export async function fetchLatestApkRelease(
  fetcher: typeof fetch = fetch,
): Promise<ApkRelease | null> {
  const response = await fetcher(LATEST_APK_RELEASE_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) return null;

  return pickApkRelease(await response.json());
}

/**
 * The version baked into this bundle at build time (`1.12.0` in a release,
 * `1.12.0-dev` on a dev server). `typeof` guards the unit tests, which do not
 * go through Vite's `define`.
 */
export function readBuildVersion(): string {
  try {
    return typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const LAST_CHECK_KEY = "apkUpdate.lastCheck";
const NOTIFIED_PREFIX = "apkUpdate.notified.";
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Avoids hitting the GitHub API on every resume; a release is not hourly. */
export function shouldCheckNow(now: number = Date.now()): boolean {
  try {
    const last = Number(localStorage.getItem(LAST_CHECK_KEY) ?? 0);
    return !Number.isFinite(last) || now - last > CHECK_INTERVAL_MS;
  } catch {
    return true;
  }
}

export function markChecked(now: number = Date.now()): void {
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(now));
  } catch {
    /* storage unavailable: checking every resume is acceptable */
  }
}

const PENDING_KEY = "apkUpdate.pending";

/**
 * Remembers the update across app restarts. Without it, tapping the
 * notification after the app was killed would reopen the app with nothing to
 * install, because the 6-hour throttle would skip the check.
 */
export function readPendingRelease(): ApkRelease | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ApkRelease> | null;
    if (
      !parsed ||
      typeof parsed.version !== "string" ||
      typeof parsed.apkUrl !== "string"
    ) {
      return null;
    }

    return {
      version: parsed.version,
      apkUrl: parsed.apkUrl,
      sizeBytes:
        typeof parsed.sizeBytes === "number" ? parsed.sizeBytes : undefined,
      notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
    };
  } catch {
    return null;
  }
}

export function savePendingRelease(release: ApkRelease): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(release));
  } catch {
    /* storage unavailable: the in-memory dialog still works this session */
  }
}

export function clearPendingRelease(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** One notification per version, so a resume loop cannot spam the tray. */
export function wasNotified(version: string): boolean {
  try {
    return localStorage.getItem(`${NOTIFIED_PREFIX}${version}`) === "1";
  } catch {
    return false;
  }
}

export function markNotified(version: string): void {
  try {
    localStorage.setItem(`${NOTIFIED_PREFIX}${version}`, "1");
  } catch {
    /* storage unavailable: at worst the user sees it twice */
  }
}
