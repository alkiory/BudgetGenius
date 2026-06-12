import { HttpBudgetRepository } from "@adapters/http/budget.repository";
import { Budget } from "@domain/dashboard/budgets/budget.entity";

export const getBudgets = async () => {
  return await HttpBudgetRepository.getAll();
}

export const getBudget = async (budgetId: number) => {
  return await HttpBudgetRepository.getBudget(budgetId);
}

export const getAllCategoriesByQuery = async (query: { budgetId?: number; name?: string; }) => {
  return await HttpBudgetRepository.getAllCategoriesByQuery(query);
}

export const createBudget = async (budget: Omit<Budget, "id">) => {
  return await HttpBudgetRepository.createBudget(budget);
}

export const updateBudget = async (budget: Partial<Budget>) => {
  return await HttpBudgetRepository.updateBudget(budget);
}

export const deleteBudget = async (budgetId: number) => {
  return await HttpBudgetRepository.deleteBudget(budgetId);
}