import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHECK_INTERVAL_MS,
  clearPendingRelease,
  compareVersions,
  isNewerVersion,
  markChecked,
  normalizeVersion,
  pickApkRelease,
  readPendingRelease,
  savePendingRelease,
  shouldCheckNow,
  supportsInAppUpdates,
} from "../apk-update";

// The module reads localStorage lazily, so a stubbed store is enough to cover
// the persistence used across app restarts.
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
});

const release = (overrides: Record<string, unknown> = {}) => ({
  tag_name: "v1.13.0",
  body: "Changelog",
  assets: [
    {
      name: "checksums.txt",
      browser_download_url: "https://example.test/sums",
    },
    {
      name: "BudgetGenius-v1.13.0.apk",
      browser_download_url: "https://example.test/app.apk",
      size: 12_345,
    },
  ],
  ...overrides,
});

describe("normalizeVersion", () => {
  it("drops the tag prefix and any pre-release suffix", () => {
    expect(normalizeVersion("v1.12.0")).toBe("1.12.0");
    expect(normalizeVersion("1.12.0-dev")).toBe("1.12.0");
    expect(normalizeVersion("v2.0.1-rc.1")).toBe("2.0.1");
  });
});

describe("compareVersions", () => {
  it("orders numerically, not lexicographically", () => {
    expect(compareVersions("1.12.0", "1.11.9")).toBeGreaterThan(0);
    expect(compareVersions("1.9.0", "1.10.0")).toBeLessThan(0);
  });

  it("treats a dev build of the same release as equal", () => {
    expect(compareVersions("1.12.0-dev", "v1.12.0")).toBe(0);
    expect(isNewerVersion("1.12.0", "1.12.0-dev")).toBe(false);
  });

  it("ignores missing segments", () => {
    expect(compareVersions("1.12", "1.12.0")).toBe(0);
    expect(compareVersions("1.12.1", "1.12")).toBeGreaterThan(0);
  });
});

describe("isNewerVersion", () => {
  it("only accepts a strictly newer publish", () => {
    expect(isNewerVersion("1.13.0", "1.12.0")).toBe(true);
    expect(isNewerVersion("1.12.0", "1.12.0")).toBe(false);
    expect(isNewerVersion("1.11.0", "1.12.0")).toBe(false);
  });
});

describe("pickApkRelease", () => {
  it("returns the APK asset of a release", () => {
    expect(pickApkRelease(release())).toEqual({
      version: "1.13.0",
      apkUrl: "https://example.test/app.apk",
      sizeBytes: 12_345,
      notes: "Changelog",
    });
  });

  it("returns null when the release has no APK attached", () => {
    expect(
      pickApkRelease(
        release({
          assets: [
            {
              name: "notes.txt",
              browser_download_url: "https://example.test/n",
            },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("returns null for a tag that is not a version", () => {
    expect(pickApkRelease(release({ tag_name: "nightly" }))).toBeNull();
    expect(pickApkRelease(release({ tag_name: "v1.13.0-beta" }))).toBeNull();
  });

  it("returns null for a malformed payload", () => {
    expect(pickApkRelease(null)).toBeNull();
    expect(pickApkRelease({ tag_name: "v1.13.0" })).toBeNull();
  });
});

describe("pending release persistence", () => {
  beforeEach(() => {
    store.clear();
  });

  it("round-trips the release across restarts", () => {
    savePendingRelease({
      version: "1.13.0",
      apkUrl: "https://example.test/app.apk",
    });
    expect(readPendingRelease()).toEqual({
      version: "1.13.0",
      apkUrl: "https://example.test/app.apk",
      sizeBytes: undefined,
      notes: undefined,
    });
  });

  it("ignores corrupted or incomplete entries", () => {
    store.set("apkUpdate.pending", "{not json");
    expect(readPendingRelease()).toBeNull();

    store.set("apkUpdate.pending", JSON.stringify({ version: "1.13.0" }));
    expect(readPendingRelease()).toBeNull();
  });

  it("clears on dismissal", () => {
    savePendingRelease({
      version: "1.13.0",
      apkUrl: "https://example.test/app.apk",
    });
    clearPendingRelease();
    expect(readPendingRelease()).toBeNull();
  });
});

describe("platform guard", () => {
  it("is inert outside the Android app", () => {
    expect(supportsInAppUpdates()).toBe(false);
  });
});

describe("check throttling", () => {
  beforeEach(() => {
    store.clear();
  });

  it("checks once per window", () => {
    const now = 1_700_000_000_000;
    expect(shouldCheckNow(now)).toBe(true);

    markChecked(now);
    expect(shouldCheckNow(now + 60_000)).toBe(false);
    expect(shouldCheckNow(now + CHECK_INTERVAL_MS + 1)).toBe(true);
  });
});
