import { changelog } from "@presentation/data/changelog";

/**
 * Shared "last seen version" state for the public changelog.
 *
 * `/changelog` stamps the newest release here on every visit, which lets
 * both the per-entry "new" pills and the header dot answer the same
 * question: has anything shipped since this browser last looked?
 */

/** localStorage key shared by the changelog page and the header dot. */
export const CHANGELOG_SEEN_STORAGE_KEY = "changelogLastSeenVersion";

/** Same-tab notification fired after the changelog is marked as seen. */
export const CHANGELOG_SEEN_EVENT = "changelog:seen";

/** Parses a `major.minor` version into numbers; null when malformed. */
export function parseChangelogVersion(
  version: string,
): [number, number] | null {
  const match = /^(\d+)\.(\d+)$/.exec(version.trim());
  return match ? [Number(match[1]), Number(match[2])] : null;
}

/** Numeric comparison so `1.10` counts as newer than `1.9`. */
export function isNewerChangelogVersion(
  candidate: string,
  baseline: string,
): boolean {
  const a = parseChangelogVersion(candidate);
  const b = parseChangelogVersion(baseline);
  if (!a || !b) return false;
  return a[0] === b[0] ? a[1] > b[1] : a[0] > b[0];
}

/** Version of the newest entry in the changelog data, if any. */
export function getLatestChangelogVersion(): string | null {
  return changelog[0]?.version ?? null;
}

/** Stored version, validated so a corrupted value reads as "first visit". */
export function readLastSeenChangelogVersion(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CHANGELOG_SEEN_STORAGE_KEY);
    return raw && parseChangelogVersion(raw) ? raw : null;
  } catch {
    // Storage can be blocked (private mode / denied cookies).
    return null;
  }
}

/**
 * True when the newest release is newer than the one this browser last
 * saw. A visitor with nothing stored is treated as having unseen releases
 * so the changelog is still discoverable on the first visit.
 */
export function hasUnseenChangelogReleases(): boolean {
  const latest = getLatestChangelogVersion();
  if (!latest) return false;
  const lastSeen = readLastSeenChangelogVersion();
  return lastSeen === null || isNewerChangelogVersion(latest, lastSeen);
}

/** Stamps the newest release as seen and notifies same-tab listeners. */
export function markChangelogSeen(): void {
  if (typeof window === "undefined") return;
  const latest = getLatestChangelogVersion();
  if (!latest) return;
  try {
    window.localStorage.setItem(CHANGELOG_SEEN_STORAGE_KEY, latest);
  } catch {
    // Storage unavailable: the page still renders; the dot reappears on
    // the next load.
  }
  window.dispatchEvent(new Event(CHANGELOG_SEEN_EVENT));
}
