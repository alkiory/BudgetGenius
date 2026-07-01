/**
 * @module downloadService
 * Cross-platform file-download service.
 *
 * Problem (Android APK audit, 2026-06): the previous `downloadBlob.ts`
 * used `URL.createObjectURL` + an `anchor.click()` hack. That's the
 * standard browser flow but **silently fails inside the Capacitor
 * WebView on Android** — the platform has no shared downloads folder
 * exposed to the WebView the same way a desktop browser has its
 * "Downloads" directory. The user sees the "downloading\u2026" toast
 * but the file never appears.
 *
 * Solution: branch on `isNativePlatform()`. Web keeps the
 * ObjectURL+anchor trick; Capacitor (Android today, iOS tomorrow)
 * writes the blob to a Capacitor-managed directory and opens the
 * OS share sheet, which IS the native equivalent of "Save As\u2026"
 * on mobile. The user picks Drive / Files / Gmail / etc. and the
 * file lands wherever they choose.
 *
 * Why **Directory.External** (not `Directory.Documents` as the spec
 * suggested): Android 10+ scoped storage blocks writes to
 * `Environment.getExternalStoragePublicDirectory(...)` without
 * `MANAGE_EXTERNAL_STORAGE`, which is a permission most users won't
 * grant a finance app. `Directory.External` maps to the
 * app-scoped `/storage/emulated/0/Android/data/<pkg>/files/` on
 * Android — persistent, no permission required, covered by the
 * existing FileProvider config (`apps/mobile/android/app/src/main/
 * res/xml/file_paths.xml`'s `<external-path path="."/>`).
 *
 * Capacitor's Share plugin auto-converts the returned `file://`
 * URI into a `content://` URI via the FileProvider authority
 * `${applicationId}.fileprovider`, so the receiving app sees a
 * properly-scoped, time-limited read grant.
 *
 * Dynamic imports: the `vite.config.ts` rolls Capacitor plugins
 * up only when `VITE_CAPACITOR === "true"` (APK builds). For
 * plain web builds it marks them as `external`, so any static
 * import would emit a bare module specifier that the web bundle
 * can't resolve. Dynamic `await import(...)` keeps the specifier
 * alive, and the `isNativePlatform()` guard (which returns false
 * on web) routes through the `triggerBrowserDownload` branch
 * before the dynamic imports are ever evaluated.
 */

import { isNativePlatform } from "@infrastructure/native";

export interface DownloadOptions {
  /**
   * Title shown in the Android system share sheet (native only).
   * Defaults to a localised fallback so callers don't have to know
   * whether the user is on Android or web.
   */
  dialogTitle?: string;
  /**
   * Subtitle / message text shown in the share sheet (native only).
   */
  dialogSubtitle?: string;
}

export interface DownloadResult {
  /**
   * `true` once the file is on disk (web: download triggered;
   * native: written to the app-scoped directory). Web doesn't
   * surface a save location because the browser owns it.
   */
  savedToDisk: boolean;
  /** Native only: the resulting filesystem URI. */
  uri?: string;
  /** `true` when the share sheet was opened (native only). */
  sharedViaSystemSheet?: boolean;
}

const NATIVE_DIALOG_FALLBACK_TITLE = "Save or share report";
const NATIVE_DIALOG_FALLBACK_TEXT = "BudgetGenius report";

/**
 * Save or share a binary blob as `filename`. Web uses the standard
 * `URL.createObjectURL` + anchor download trick; Capacitor-native
 * Android writes the file into the app's external-scoped
 * directory and opens the system share sheet so the user can pick
 * Drive, Files, Gmail, or any other registered share target.
 *
 * The function is `async` even on web so callers can uniformly
 * `await` it and surface a single success/error toast that
 * reflects the actual state of the download (web: triggered;
 * native: saved + share sheet shown).
 */
export async function downloadBlob(
  blob: Blob,
  filename: string,
  options: DownloadOptions = {},
): Promise<DownloadResult> {
  if (isNativePlatform()) {
    return await downloadToNativeExternal(blob, filename, options);
  }
  triggerBrowserDownload(blob, filename);
  return { savedToDisk: true };
}

/**
 * The original web flow, kept verbatim from the previous
 * `presentation/utils/downloadBlob.ts` so web behaviour is
 * byte-for-byte unchanged.
 *
 * NOTE: the anchor is appended/removed in a try/finally so a stuck
 * DOM append never leaks a temporary element across downloads if
 * the user dismisses the browser's confirmation dialog.
 */
function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  }
}

/**
 * Native write + share flow. Dynamic imports are deliberate \u2014 the
 * vite config externalises these plugins for web builds.
 */
async function downloadToNativeExternal(
  blob: Blob,
  filename: string,
  options: DownloadOptions,
): Promise<DownloadResult> {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");

  // Filesystem.writeFile expects a base64 string for binary
  // content. FileReader.readAsDataURL is the cheapest path here:
  // it stays in-browser, runs in O(n) instead of O(n\u00b2) per byte
  // (vs. a manual String.fromCharCode loop that crashes V8 past
  // ~64 KiB argument lists), and the result is a single string
  // we just split on the comma.
  const dataUrl = await readBlobAsDataUrl(blob);
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;

  const writeResult = await Filesystem.writeFile({
    path: filename,
    data: base64,
    // Directory.External = app-scoped external; no permission
    // needed on Android 10+, persistent across app sessions.
    directory: Directory.External,
    recursive: false,
  });

  const dialogTitle = options.dialogTitle ?? NATIVE_DIALOG_FALLBACK_TITLE;

  await Share.share({
    title: dialogTitle,
    text: options.dialogSubtitle ?? NATIVE_DIALOG_FALLBACK_TEXT,
    url: writeResult.uri,
    dialogTitle,
  });

  return {
    savedToDisk: true,
    uri: writeResult.uri,
    sharedViaSystemSheet: true,
  };
}

/**
 * Read a Blob as a base64-encoded data URL via FileReader.
 * The returned string has the form `data:<mime>;base64,<data>`;
 * callers that want only the payload split on the comma.
 */
function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("FileReader returned non-string result"));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("FileReader failed"));
    };
    reader.readAsDataURL(blob);
  });
}
