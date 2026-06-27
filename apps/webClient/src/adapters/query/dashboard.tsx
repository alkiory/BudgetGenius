import { HttpBudgetRepository } from "@adapters/http/budget.repository";
import { HttpDashboardRepository } from "@adapters/http/dashboard.repository";
import { HttpTransactionRepository } from "@adapters/http/transaction.repository";
import { QueryParam } from "@domain/dashboard/budgets/budget.repository";
import { TransactionTypeFilter } from "@domain/dashboard/transactions/transaction.entity";
import { useQuery } from "@tanstack/react-query";

// Wave 2 [T2.8]: budget-related queries now use `staleTime: 30 * 1000`
// (30s) instead of the previous 60s. The tighter window ensures that
// mobile users on flaky cellular networks don't see stale numbers after
// focus/blur cycles, while still avoiding the default-`0` thrashing
// (every focus = full refetch). `gcTime` is kept at 5 min so an
// inactive cache stays warm enough to avoid a re-fetch storm after
// short tab switches.

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
    // 30s — kept conservative; matches the dashboard widget refresh
    // cadence after a transaction mutation (mutation invalidates via
    // ["transactions"]; this window keeps the background refetch
    // responsive under tab focus / page re-entry on mobile).
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
};
