export function timezoneToLocale(timezone: string): string {
  const mapping: Record<string, string> = {
    "Europe/Paris": "fr-FR",
    "America/New_York": "en-US",
    "America/Los_Angeles": "en-US",
    "Bogota/Colombia": "es-CO",
    "Asia/Tokyo": "ja-JP",
    "Europe/Berlin": "de-DE",
    "Europe/London": "en-GB",
  };

  return mapping[timezone] || "en-US";
}
