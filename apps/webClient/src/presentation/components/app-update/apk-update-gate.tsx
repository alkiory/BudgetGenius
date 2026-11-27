import { useApkUpdate } from "@application/app-update/use-apk-update";
import {
  ApkUpdate,
  markNotified,
  wasNotified,
} from "@infrastructure/apk-update";
import { Modal } from "@presentation/components/modal/modal";
import { Button } from "@presentation/components/ui/button";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/**
 * Surfaces a published APK from inside the app: a system notification when the
 * update is first detected, and a dialog that downloads it and opens Android's
 * installer. Renders nothing on the web.
 */
export function ApkUpdateGate() {
  const { t } = useTranslation();
  const { release, installing, failure, install, dismiss } = useApkUpdate();

  useEffect(() => {
    if (!release || wasNotified(release.version)) return;

    let cancelled = false;
    void (async () => {
      try {
        const { enabled } = await ApkUpdate.notificationsEnabled();
        if (!enabled) {
          // Android 13+ asks at runtime. The native call resolves only after
          // the user answers; if they decline, skip the post without marking it
          // as sent, so a later grant still notifies.
          const afterPrompt = await ApkUpdate.requestNotificationPermission();
          if (!afterPrompt.enabled) return;
        }

        await ApkUpdate.notifyUpdate({
          title: t("appUpdate.notificationTitle"),
          body: t("appUpdate.notificationBody", { version: release.version }),
        });

        if (!cancelled) markNotified(release.version);
      } catch {
        // Notifications are a convenience: the dialog still shows.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [release, t]);

  if (!release) return null;

  return (
    <Modal isOpen onClose={dismiss} title={t("appUpdate.title")}>
      <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {t("appUpdate.description", { version: release.version })}
      </p>

      {failure === "permission" && (
        <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <p className="mb-2">{t("appUpdate.permissionHint")}</p>
          <Button
            variant="outline"
            onClick={() => void ApkUpdate.openInstallSettings()}
          >
            {t("appUpdate.openSettings")}
          </Button>
        </div>
      )}

      {failure === "download" && (
        <p className="mb-4 rounded-md bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
          {t("appUpdate.downloadError")}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={dismiss} disabled={installing}>
          {t("common.cancel")}
        </Button>
        <Button onClick={() => void install()} disabled={installing}>
          {installing ? t("appUpdate.downloading") : t("appUpdate.updateNow")}
        </Button>
      </div>
    </Modal>
  );
}
