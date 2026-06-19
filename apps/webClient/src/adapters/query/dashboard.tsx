import { HttpBudgetRepository } from "@adapters/http/budget.repository";
import { HttpDashboardRepository } from "@adapters/http/dashboard.repository";
import { HttpTransactionRepository } from "@adapters/http/transaction.repository";
import { QueryParam } from "@domain/dashboard/budgets/budget.repository";
import { TransactionTypeFilter } from "@domain/dashboard/transactions/transaction.entity";
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

// Phase 3 (T3.4 + T3.9): useFetchTransactions now accepts an optional
// `type` filter ("income" | "expense"). The cache key includes the type
// suffix when present so React Query's prefix invalidation
// (`["transactions"]`) still catches both filtered and unfiltered
// caches. Existing transaction-page callers pass no type and continue
// to receive the full list (server-side: the repo applies the
// sign-convention where-clause only when type is forwarded).
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

export const useFetchRecentSummary = (limit: number = 50) => {
  return useQuery({
    queryKey: ["recent-summary", limit],
    queryFn: () => HttpDashboardRepository.getRecentSummary(limit),
    retry: 3,
    // 30s — the dashboard widget surfaces recently added transactions
    // (mutation invalidates via ["transactions"]; this staleTime keeps the
    // background refetch responsive under tab focus / page re-entry).
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
  });
};
