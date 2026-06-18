import {
  BudgetCategory,
  Budget,
} from "@domain/dashboard/budgets/budget.entity";
import { BudgetRepository } from "@domain/dashboard/budgets/budget.repository";
import api from "@infrastructure/api.config";

export const HttpBudgetRepository: BudgetRepository = {
  async getAll() {
    const response = await api.get("/budgets");
    return response.data;
  },

  async getAllCategoriesByQuery(query: { budgetId?: number; name?: string }) {
    if (query.budgetId === 0) return;
    if (!query.name) delete query.name;
    const response = await api.get("/budgets/categories", { params: query });
    return response.data;
  },

  async getBudget(budgetId: number) {
    const response = await api.get(`/budgets/${budgetId}`);
    return response.data;
  },

  async createBudget(budget: Partial<Budget>) {
    const response = await api.post("/budgets", budget);
    return response.data;
  },

  async updateBudget(budget: Partial<Budget>) {
    const response = await api.put("/budgets", budget);
    return response.data;
  },

  async deleteBudget(budgetId: number) {
    const response = await api.delete(`/budgets/${budgetId}`);
    return response.data;
  },

  async createBudgetCategory(category: Partial<BudgetCategory>) {
    const response = await api.post("/budgets/category", category);
    return response.data;
  },

  async updateBudgetCategory(category: Partial<BudgetCategory>) {
    const response = await api.put("/budgets/category", category);
    return response.data;
  },

  async deleteBudgetCategory(categoryId: number) {
    const response = await api.delete(`/budgets/category/${categoryId}`);
    return response.data;
  },
};
