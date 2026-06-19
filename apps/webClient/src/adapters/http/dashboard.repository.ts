import { DashboardRepository } from "@domain/dashboard/dashboard.repository";
import api from "@infrastructure/api.config";

const DEFAULT_RECENT_SUMMARY_LIMIT = 50;

export const HttpDashboardRepository: DashboardRepository = {
  async getAll() {
    const response = await api.get("/dashboard/overview");
    return response.data;
  },

  async getExpenseCategorys() {
    const response = await api.get("/dashboard/expense-breakdown");
    return response.data;
  },

  async getRecentSummary(limit = DEFAULT_RECENT_SUMMARY_LIMIT) {
    const response = await api.get(`/dashboard/recent-summary?limit=${limit}`);
    return response.data;
  },
};
