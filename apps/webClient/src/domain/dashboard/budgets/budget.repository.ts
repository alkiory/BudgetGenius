import { Budget, BudgetCategory, ReconciliationQueue } from "./budget.entity";

export type QueryParam = {
  budgetId?: number;
  name?: string;
};

/** One deposit into a savings goal: it bumps the goal and writes a ledger row. */
export type SavingsContributionInput = {
  categoryId: number;
  amount: number;
  /** Calendar day (`YYYY-MM-DD`) the money was put aside. */
  date: string;
  description?: string;
};

export type SavingsContributionResult = {
  transaction: {
    id: number;
    date: string;
    description: string;
    category: string;
    amount: number;
  };
  category: BudgetCategory;
  budget: Budget;
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
  /** Atomic: goal bump + transaction in one API call. */
  contributeToSavings: (
    payload: SavingsContributionInput,
  ) => Promise<SavingsContributionResult>;
  deleteBudgetCategory: (categoryId: number) => Promise<void>;
  getReconciliation: () => Promise<ReconciliationQueue>;
  reconcileExpense: (
    transactionId: number,
    budgetCategoryId: number,
  ) => Promise<{ id: number; budgetCategoryId: number }>;
}
