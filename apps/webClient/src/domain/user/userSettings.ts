import { Currency } from "@presentation/utils/currencyService";

export type UserSettings = {
  id: number;
  timezone: string;
  currency: Currency;
  locale?: string;
};

export function UserSettings({ id, timezone, currency, locale }: UserSettings) {
  return {
    id,
    timezone,
    currency,
    locale,
  };
}
