import api from "@infrastructure/api.config";

export type UserExpenseCategory = { id: number; name: string; value: number };

export const HttpExpenseCategoryRepository = {
  async getAll(): Promise<UserExpenseCategory[]> {
    const response = await api.get("/expense-categories");
    return response.data;
  },

  async importMany(categories: Array<Pick<UserExpenseCategory, "name" | "value">>): Promise<{ created: number; skipped: number }> {
    const response = await api.post("/expense-categories/import", { categories });
    return response.data;
  },
};
