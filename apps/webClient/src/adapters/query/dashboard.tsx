import { HttpBudgetRepository } from "@adapters/http/budget.repository";
import { HttpDashboardRepository } from "@adapters/http/dashboard.repository";
import { HttpTransactionRepository } from "@adapters/http/transaction.repository";
import { QueryParam } from "@domain/dashboard/budgets/budget.repository";
import { TransactionTypeFilter } from "@domain/dashboard/transactions/transaction.entity";
import { useQuery } from "@tanstack/react-query";

const STALE_TIME_MS = 30 * 1000;
const GC_TIME_MS = 1000 * 60 * 5;

export const useFetchDashboard = () => {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: HttpDashboardRepository.getAll,
    retry: 3,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
};

export const useFetchExpenseCategories = () => {
  return useQuery({
    queryKey: ["expense-categories"],
    queryFn: HttpDashboardRepository.getExpenseCategorys,
    retry: 3,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
};

export const useFetchTransactions = (
  offset: number,
  limit: number,
  type?: TransactionTypeFilter,
) => {
  return useQuery({
    queryKey: type
      ? ["transactions", offset, limit, type]
      : ["transactions", offset, limit],
    queryFn: () => HttpTransactionRepository.getAll(offset, limit, type),
    retry: 3,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
};

export const useFetchBudgets = () => {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: HttpBudgetRepository.getAll,
    retry: 3,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
};

export const useFetchBudgetCategories = ({ budgetId, name }: QueryParam) => {
  const query = { budgetId, name };
  return useQuery({
    queryKey: ["budget-categories", budgetId],
    queryFn: () => HttpBudgetRepository.getAllCategoriesByQuery(query),
    retry: 3,
    enabled: !!budgetId,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
};

export const useFetchRecentSummary = (limit: number = 50) => {
  return useQuery({
    queryKey: ["recent-summary", limit],
    queryFn: () => HttpDashboardRepository.getRecentSummary(limit),
    retry: 3,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
};
