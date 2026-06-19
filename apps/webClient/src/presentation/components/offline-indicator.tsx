import { hasQueuedRequests } from "@infrastructure/offline-queue";
import { Wifi, WifiOff, CloudOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function OfflineIndicator() {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) {
    // Show a brief indicator if there are pending items waiting to sync
    if (hasQueuedRequests()) {
      return (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          <CloudOff className="h-4 w-4" />
          <span>{t("errors.syncingPending")}</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
      <WifiOff className="h-4 w-4" />
      <span>{t("errors.offlineMessage")}</span>
    </div>
  );
}
