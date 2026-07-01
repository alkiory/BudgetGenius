import { Currency } from "@presentation/utils/currencyService";

export type UserSettings = {
  id: number;
  timezone: string;
  currency: Currency;
  locale?: string;
  /**
   * Defaulted to `false` on row creation (DB column DEFAULT FALSE).
   * Toggled to `true` after the onboarding wizard saves the
   * three preferences. Treat `undefined` as `false` defensively
   * so legacy rows that pre-date the migration do not get stuck
   * in a re-prompt loop on a hot-swap recovery.
   */
  hasCompletedOnboarding?: boolean;
};

export function UserSettings({
  id,
  timezone,
  currency,
  locale,
  hasCompletedOnboarding,
}: UserSettings) {
  return {
    id,
    timezone,
    currency,
    locale,
    hasCompletedOnboarding,
  };
}
