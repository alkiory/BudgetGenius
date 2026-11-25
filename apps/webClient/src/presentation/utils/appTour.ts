/**
 * Persistence for the driver.js product tour.
 *
 * Two independent signals decide whether the tour runs:
 *  - `sessionStorage` flag set when the wizard saves, so a brand-new user
 *    gets the full dashboard tour right after onboarding.
 *  - the last build version this browser saw, so existing users get the
 *    "what's new" tour once after every deploy.
 *
 * Both helpers swallow storage errors (private mode / blocked cookies):
 * a browser that cannot persist simply sees the tour again next visit
 * instead of crashing the dashboard.
 */

export const ONBOARDING_JUST_FINISHED_KEY =
  "budgetgenius:onboarding-just-finished";

export const TOUR_VERSION_STORAGE_KEY = "budgetgenius:last-tour-version";

/** Called by the onboarding wizard right before it redirects to the dashboard. */
export function markOnboardingJustFinished(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ONBOARDING_JUST_FINISHED_KEY, "1");
  } catch {
    // Storage unavailable: the tour simply does not run for this user.
  }
}

/** True while the wizard flag is waiting for the tour to launch. */
export function hasPendingOnboardingTour(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.sessionStorage.getItem(ONBOARDING_JUST_FINISHED_KEY) === "1"
    );
  } catch {
    return false;
  }
}

/** Reads and clears the wizard flag so the tour fires exactly once. */
export function consumeOnboardingJustFinished(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const pending =
      window.sessionStorage.getItem(ONBOARDING_JUST_FINISHED_KEY) === "1";
    if (pending) {
      window.sessionStorage.removeItem(ONBOARDING_JUST_FINISHED_KEY);
    }
    return pending;
  } catch {
    return false;
  }
}

/** Build version whose tour this browser already completed. */
export function readSeenTourVersion(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOUR_VERSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Stamps the running build so the tour stays quiet until the next deploy. */
export function markTourVersionSeen(version: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOUR_VERSION_STORAGE_KEY, version);
  } catch {
    // Storage unavailable: nothing to persist.
  }
}
