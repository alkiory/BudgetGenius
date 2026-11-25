import { AnnouncementRow } from "@adapters/http/announcement.repository";
import { useLiveAnnouncements } from "@adapters/query/announcements";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "@presentation/components/ui/animated-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const DISMISS_KEY = "bg_announcements_dismissed";

/**
 * Dismissals are keyed by `id:updatedAt`, so editing and republishing an
 * announcement in the backoffice shows it again while a plain re-render does
 * not.
 */
const signature = (row: AnnouncementRow) => `${row.id}:${row.updatedAt}`;

function readDismissed(): string[] {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

const LEVEL_STYLES: Record<
  AnnouncementRow["level"],
  { wrapper: string; icon: typeof Info }
> = {
  info: {
    wrapper:
      "border-teal-400/30 bg-teal-500/10 text-teal-800 dark:text-teal-100",
    icon: Info,
  },
  success: {
    wrapper:
      "border-emerald-400/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100",
    icon: CheckCircle2,
  },
  warning: {
    wrapper:
      "border-amber-400/30 bg-amber-500/10 text-amber-800 dark:text-amber-100",
    icon: AlertTriangle,
  },
  critical: {
    wrapper:
      "border-rose-400/30 bg-rose-500/10 text-rose-800 dark:text-rose-100",
    icon: AlertTriangle,
  },
};

/** Banner shown inside the app for announcements sent from the backoffice. */
export function AnnouncementBanner() {
  const { t } = useTranslation();
  const { data } = useLiveAnnouncements();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  const announcement = data?.find(
    (row) => !dismissed.includes(signature(row)),
  );
  if (!announcement) return null;

  const style = LEVEL_STYLES[announcement.level] ?? LEVEL_STYLES.info;
  const Icon = style.icon;

  const dismiss = () => {
    const next = [...dismissed, signature(announcement)].slice(-50);
    setDismissed(next);
    try {
      window.localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: the banner simply reappears on reload.
    }
  };

  return (
    <div className="px-4 pt-4 md:px-6">
      <div
        role="status"
        className={`group flex items-start gap-3 rounded-xl border px-4 py-3 shadow-sm backdrop-blur-sm ${style.wrapper}`}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{announcement.title}</p>
          <p className="mt-0.5 whitespace-pre-line text-xs opacity-90">
            {announcement.body}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("announcements.dismiss")}
          className="rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
