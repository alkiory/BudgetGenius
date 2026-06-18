import { ReportsRepository } from "@domain/dashboard/reports/reports.repository";
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
};
