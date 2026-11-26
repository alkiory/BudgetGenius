import { AnnouncementRow } from "@adapters/http/announcement.repository";
import { useLiveAnnouncements } from "@adapters/query/announcements";
import {
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
} from "@presentation/components/ui/animated-icons";
import { TextType } from "@presentation/components/ui/text-type";
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
  { wrapper: string; glow: string; icon: typeof Info }
> = {
  info: {
    wrapper:
      "border-teal-400/40 bg-white/92 text-teal-900 dark:border-teal-400/30 dark:bg-[#08202a]/95 dark:text-teal-50",
    glow: "bg-teal-400/30",
    icon: Info,
  },
  success: {
    wrapper:
      "border-emerald-400/40 bg-white/92 text-emerald-900 dark:border-emerald-400/30 dark:bg-[#07231b]/95 dark:text-emerald-50",
    glow: "bg-emerald-400/30",
    icon: CheckCircle2,
  },
  warning: {
    wrapper:
      "border-amber-400/50 bg-white/92 text-amber-900 dark:border-amber-400/30 dark:bg-[#241a06]/95 dark:text-amber-50",
    glow: "bg-amber-400/30",
    icon: AlertTriangle,
  },
  critical: {
    wrapper:
      "border-rose-400/50 bg-white/92 text-rose-900 dark:border-rose-400/30 dark:bg-[#26090f]/95 dark:text-rose-50",
    glow: "bg-rose-400/30",
    icon: AlertTriangle,
  },
};

function AnnouncementCard({
  announcement,
  onDismiss,
}: {
  announcement: AnnouncementRow;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const style = LEVEL_STYLES[announcement.level] ?? LEVEL_STYLES.info;
  const Icon = style.icon;
  // Long bodies finish in roughly the same time as short ones, so an
  // announcement never blocks the screen for half a minute.
  const bodySpeed = Math.min(
    14,
    Math.max(4, Math.round(1800 / Math.max(announcement.body.length, 1))),
  );

  return (
    <article
      role="status"
      aria-live="polite"
      className={`animate-announce-in pointer-events-auto relative overflow-hidden rounded-2xl border p-4 shadow-[0_24px_70px_-20px_rgb(2_6_23_/_0.55)] backdrop-blur-xl ${style.wrapper}`}
    >
      <span
        aria-hidden="true"
        className="animate-announce-glow pointer-events-none absolute inset-0 rounded-2xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-50"
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full blur-2xl ${style.glow}`}
      />

      <div className="relative flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 ring-1 ring-inset ring-black/10 dark:bg-white/10 dark:ring-white/15">
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] opacity-60">
            {t(`superadmin.notifications.levels.${announcement.level}`)}
          </p>
          <p className="mt-0.5 text-sm font-semibold">
            <TextType
              text={announcement.title}
              typingSpeed={38}
              cursor
              startOnVisible
            />
          </p>
          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed opacity-90">
            <TextType
              text={announcement.body}
              typingSpeed={bodySpeed}
              startOnVisible
            />
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("announcements.dismiss")}
          className="rounded-md p-1 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

/**
 * Announcements sent from the backoffice stay pinned above the app until the
 * reader closes them — no auto-dismiss, no scrolling out of view. Live
 * announcements stack (one per level, up to four) instead of replacing each
 * other, and the dismissal is remembered per announcement revision.
 */
export function AnnouncementBanner() {
  const { data } = useLiveAnnouncements();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  const visible = (data ?? [])
    .filter((row) => !dismissed.includes(signature(row)))
    // One notice per level fits without hiding the last one; the API caps a
    // reader at five, so four is the visual budget before scrolling.
    .slice(0, 4);

  if (!visible.length) return null;

  const dismiss = (announcement: AnnouncementRow) => {
    const next = [...dismissed, signature(announcement)].slice(-50);
    setDismissed(next);
    try {
      window.localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: the banner simply reappears on reload.
    }
  };

  return (
    <div className="pointer-events-none fixed right-3 top-[max(env(safe-area-inset-top),0.75rem)] z-[90] flex max-h-[calc(100dvh_-_1.5rem)] w-[min(24rem,calc(100vw_-_1.5rem))] flex-col gap-3 overflow-y-auto sm:right-5">
      {visible.map((announcement) => (
        <AnnouncementCard
          key={signature(announcement)}
          announcement={announcement}
          onDismiss={() => dismiss(announcement)}
        />
      ))}
    </div>
  );
}
