import { App as CapacitorApp } from "@capacitor/app";
import { Directory, Filesystem } from "@capacitor/filesystem";
import {
  ApkUpdate,
  clearPendingRelease,
  fetchLatestApkRelease,
  isNewerVersion,
  markChecked,
  readBuildVersion,
  readPendingRelease,
  savePendingRelease,
  shouldCheckNow,
  supportsInAppUpdates,
  type ApkRelease,
} from "@infrastructure/apk-update";
import { useCallback, useEffect, useRef, useState } from "react";

export type ApkUpdateFailure = "download" | "permission" | null;

/**
 * Android-only update flow.
 *
 * Checks the latest GitHub release against the version baked into this bundle,
 * and on request downloads the APK into the app cache and hands it to the
 * system installer. The install itself is never silent: Android shows its own
 * confirmation, and the user has to allow "install unknown apps" for this app
 * once — which is why the failure is surfaced as an actionable state instead of
 * a generic error.
 *
 * Web builds return an inert state: a browser tab has nothing to update.
 */
export function useApkUpdate() {
  // A release found in a previous session (or before the app was killed from
  // the notification) is restored, unless this build already caught up.
  const [release, setRelease] = useState<ApkRelease | null>(() => {
    if (!supportsInAppUpdates()) return null;

    const pending = readPendingRelease();
    if (!pending) return null;
    if (!isNewerVersion(pending.version, readBuildVersion())) {
      clearPendingRelease();
      return null;
    }

    return pending;
  });
  const [installing, setInstalling] = useState(false);
  const [failure, setFailure] = useState<ApkUpdateFailure>(null);
  const checking = useRef(false);
  // A download that already finished: retrying after the Settings detour must
  // not transfer the APK again.
  const downloadedApk = useRef<{ version: string; path: string } | null>(null);
  // Bumped on dismissal so an in-flight install stops before it opens an
  // Android activity for a dialog the user already closed.
  const runId = useRef(0);

  const check = useCallback(async (force = false) => {
    if (!supportsInAppUpdates() || checking.current) return;
    if (!force && !shouldCheckNow()) return;

    checking.current = true;
    try {
      // Marked before the request so a failing endpoint is not retried on
      // every resume; the next window gives it another chance.
      markChecked();

      const latest = await fetchLatestApkRelease();
      if (!latest || !isNewerVersion(latest.version, readBuildVersion())) {
        return;
      }

      savePendingRelease(latest);
      setRelease(latest);
    } catch {
      // Offline, rate-limited or GitHub unreachable: next resume retries.
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    if (!supportsInAppUpdates()) return;

    void check();

    let disposed = false;
    let removeListener: (() => void) | undefined;

    void CapacitorApp.addListener("resume", () => {
      void check();
    }).then((handle) => {
      if (disposed) {
        void handle.remove();
        return;
      }
      removeListener = () => void handle.remove();
    });

    return () => {
      disposed = true;
      removeListener?.();
    };
  }, [check]);

  const install = useCallback(async () => {
    if (!release) return;

    const run = ++runId.current;
    const cancelled = () => runId.current !== run;

    setInstalling(true);
    setFailure(null);

    try {
      // Checked first: on a fresh install the Settings detour would otherwise
      // download the whole APK and then throw it away.
      const { allowed } = await ApkUpdate.canInstallPackages();
      if (cancelled()) return;
      if (!allowed) {
        // Sends the user to the per-app toggle; tapping "Update" again
        // continues with the APK already on disk.
        await ApkUpdate.openInstallSettings();
        setFailure("permission");
        return;
      }

      let path =
        downloadedApk.current?.version === release.version
          ? downloadedApk.current.path
          : undefined;

      if (!path) {
        const downloaded = await Filesystem.downloadFile({
          url: release.apkUrl,
          // Cache root only: the FileProvider already shares that directory and
          // no parent folders have to exist beforehand.
          path: `budgetgenius-${release.version}.apk`,
          directory: Directory.Cache,
        });
        if (cancelled()) return;

        if (!downloaded.path) {
          setFailure("download");
          return;
        }

        path = downloaded.path;
        downloadedApk.current = { version: release.version, path };
      }

      if (cancelled()) return;
      await ApkUpdate.installApk({ path });
      // The installer is up; the tray notice has served its purpose.
      void ApkUpdate.cancelUpdateNotification().catch(() => {});
    } catch (error) {
      if (cancelled()) return;

      const code = (error as { code?: string }).code;
      if (code === "FILE_NOT_FOUND") {
        // The OS evicted the cached copy: the next tap downloads it again.
        downloadedApk.current = null;
        setFailure("download");
        return;
      }

      setFailure(
        code === "INSTALL_PERMISSION_REQUIRED" ? "permission" : "download",
      );
    } finally {
      setInstalling(false);
    }
  }, [release]);

  const dismiss = useCallback(() => {
    // Also stops an install that is still downloading, so closing the dialog
    // cannot open the installer afterwards.
    runId.current += 1;
    downloadedApk.current = null;
    clearPendingRelease();
    setRelease(null);
    setFailure(null);
    void ApkUpdate.cancelUpdateNotification().catch(() => {});
  }, []);

  return { release, installing, failure, install, dismiss, check };
}
