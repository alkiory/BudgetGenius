import { useTranslation } from "react-i18next";

/**
 * Purely visual unseen-release mark: solid dot with an expanding halo.
 * Decorative only (`aria-hidden`); callers that need the state announced
 * should render `ChangelogUnseenDot` or provide their own label.
 */
export function ChangelogUnseenDotMark({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-1.5 w-1.5 ${className}`}
    >
      {/* Expanding halo draws the eye without moving layout. Disabled
          for visitors who prefer reduced motion. */}
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75 motion-reduce:animate-none" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-500" />
    </span>
  );
}

/**
 * Small "unseen releases" dot rendered next to a changelog link. The
 * visually hidden label keeps the state announced to screen readers.
 */
export function ChangelogUnseenDot() {
  const { t } = useTranslation();
  return (
    <>
      <ChangelogUnseenDotMark className="ml-1 align-middle" />{" "}
      <span className="sr-only">{t("landing.changelog.newBadge")}</span>
    </>
  );
}
