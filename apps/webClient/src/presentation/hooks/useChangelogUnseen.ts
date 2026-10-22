import {
  CHANGELOG_SEEN_EVENT,
  hasUnseenChangelogReleases,
} from "@presentation/utils/changelogSeen";
import { useEffect, useState } from "react";

/**
 * Whether the newest changelog release is newer than the one this browser
 * last saw. Re-evaluates when the changelog marks itself seen in this tab
 * (`changelog:seen`) and when another tab changes the stored version
 * (`storage`), so every changelog link stays in sync.
 */
export function useChangelogUnseen(): boolean {
  const [hasUnseen, setHasUnseen] = useState<boolean>(
    hasUnseenChangelogReleases,
  );

  useEffect(() => {
    const refresh = () => setHasUnseen(hasUnseenChangelogReleases());
    window.addEventListener("storage", refresh);
    window.addEventListener(CHANGELOG_SEEN_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(CHANGELOG_SEEN_EVENT, refresh);
    };
  }, []);

  return hasUnseen;
}
