import { HttpBudgetRepository } from "@adapters/http/budget.repository";
import { HttpDashboardRepository } from "@adapters/http/dashboard.repository";
import { HttpGoalRepository } from "@adapters/http/goal.repository";
import { HttpIncomeRepository } from "@adapters/http/income.repository";
import { HttpTransactionRepository } from "@adapters/http/transaction.repository";
import { QueryParam } from "@domain/dashboard/budgets/budget.repository";
import { useQuery } from "@tanstack/react-query";

export const useFetchDashboard = () => {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: HttpDashboardRepository.getAll,
    retry: 3,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  });
};

export const useFetchExpenseCategories = () => {
  return useQuery({
    queryKey: ["expense-categories"],
    queryFn: HttpDashboardRepository.getExpenseCategorys,
    retry: 3,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  });
};

export const useFetchTransactions = (offset: number, limit: number) => {
  return useQuery({
    queryKey: ["transactions", offset, limit],
    queryFn: () => HttpTransactionRepository.getAll(offset, limit),
    retry: 3,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  });
};

export const useFetchIncomes = (offset: number, limit: number) => {
  return useQuery({
    queryKey: ["incomes", offset, limit],
    queryFn: () => HttpIncomeRepository.getAll(offset, limit),
    retry: 3,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  });
};

export const useFetchBudgets = () => {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: HttpBudgetRepository.getAll,
    retry: 3,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  });
};

export const useFetchBudgetCategories = ({ budgetId, name }: QueryParam) => {
  const query = { budgetId, name };
  return useQuery({
    queryKey: ["budget-categories", budgetId],
    queryFn: () => HttpBudgetRepository.getAllCategoriesByQuery(query),
    retry: 3,
    enabled: !!budgetId,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  });
};

export const useFetchGoals = () => {
  return useQuery({
    queryKey: ["goals"],
    queryFn: HttpGoalRepository.getAll,
    retry: 3,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  });
};
