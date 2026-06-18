import { Budget, BudgetCategory } from "./budget.entity";

export type QueryParam = {
  budgetId?: number;
  name?: string;
};

export interface BudgetRepository {
  getAll: () => Promise<Budget[]>;
  getAllCategoriesByQuery: (query: QueryParam) => Promise<BudgetCategory[]>;
  getBudget: (budgetId: number) => Promise<Budget>;
  createBudget: (budget: Partial<Budget>) => Promise<Budget>;
  updateBudget: (budget: Partial<Budget>) => Promise<Budget>;
  deleteBudget: (budgetId: number) => Promise<void>;
  createBudgetCategory: (
    category: Partial<BudgetCategory>,
  ) => Promise<BudgetCategory>;
  updateBudgetCategory: (
    category: Partial<BudgetCategory>,
  ) => Promise<BudgetCategory>;
  deleteBudgetCategory: (categoryId: number) => Promise<void>;
}
