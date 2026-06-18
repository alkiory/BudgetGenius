import { DashboardRepository } from "@domain/dashboard/dashboard.repository";
import api from "@infrastructure/api.config";

export const HttpDashboardRepository: DashboardRepository = {
  async getAll() {
    const response = await api.get("/dashboard/overview");
    return response.data;
  },

  async getExpenseCategorys() {
    const response = await api.get("/dashboard/expense-breakdown");
    return response.data;
  },
};
