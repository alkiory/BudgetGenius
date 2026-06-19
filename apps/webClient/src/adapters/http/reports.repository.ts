import {
  ExportFormat,
  ExportLocale,
  ReportsRepository,
} from "@domain/dashboard/reports/reports.repository";
import api from "@infrastructure/api.config";

export const HttpReportRepository: ReportsRepository = {
  getOverview: async ({ year }: { year: string }) => {
    const response = await api.get("/reports/overview", { params: { year } });
    return response.data;
  },

  getCategories: async ({ start, end }: { start: string; end: string }) => {
    const response = await api.get("/reports/categories", {
      params: { start, end },
    });
    return response.data;
  },
  getWeekly: async () => {
    const response = await api.get("/reports/weekly");
    return response.data;
  },
  getSavings: async ({ year }: { year: string }) => {
    const response = await api.get("/reports/savings", { params: { year } });
    return response.data;
  },
  getInsights: async ({ year }: { year: string }) => {
    const response = await api.get("/reports/insights", { params: { year } });
    return response.data;
  },
  /**
   * Downloads a binary report file (PDF or Excel) from
   * `/reports/export?format=pdf|excel&year=YYYY&locale=…`. The response
   * is requested as a Blob so axios doesn't try to JSON-parse the binary
   * payload. The `responseType: "blob"` flag MUST stay in sync with the
   * controller's response, otherwise axios will throw on the file stream.
   *
   * Locale is forwarded only when the caller supplies one; the backend
   * coerces unknown values to its English fallback so omitting it keeps
   * the legacy English output.
   */
  exportReport: async ({
    format,
    year,
    locale,
  }: {
    format: ExportFormat;
    year: string;
    locale?: ExportLocale;
  }): Promise<Blob> => {
    const response = await api.get<Blob>("/reports/export", {
      params: { format, year, locale },
      responseType: "blob",
    });
    return response.data;
  },
};
