/* eslint-disable @typescript-eslint/no-explicit-any */
export type ExportFormat = "pdf" | "excel";

/**
 * Locales the backend knows how to render month-name labels for. Kept in
 * sync with `apps/webClient/src/infrastructure/i18n/i18n.ts`
 * `SUPPORTED_LOCALES` and with the backend's `ExportLocale` set.
 */
export type ExportLocale = "en-US" | "es-CO";

export interface ReportsRepository {
  getOverview: ({ year }: { year: string }) => Promise<any>;
  getCategories: ({
    start,
    end,
  }: {
    start: string;
    end: string;
  }) => Promise<any>;
  getWeekly: () => Promise<any>;
  getSavings: ({ year }: { year: string }) => Promise<any>;
  getInsights: ({ year }: { year: string }) => Promise<any>;
  /**
   * Streams a downloadable PDF or Excel report file. Returned Blob is the
   * raw binary payload — the page layer is responsible for triggering the
   * browser's download flow (object URL → anchor click → revoke).
   *
   * `locale` flows through to the backend where it drives month-name
   * localization (and the locale-aware "Generated on …" header). Omit
   * to keep the server's English fallback.
   */
  exportReport: ({
    format,
    year,
    locale,
  }: {
    format: ExportFormat;
    year: string;
    locale?: ExportLocale;
  }) => Promise<Blob>;
}
