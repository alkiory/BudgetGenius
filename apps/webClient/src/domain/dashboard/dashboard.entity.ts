import type { Transaction } from "./transactions/transaction.entity";

export type DashboardOverview = {
  balance: number;
  income: number;
  expenses: number;
  period: Date;
};

export interface ExpenseCategoryBreakdown {
  name: string;
  value: number;
}

export interface ExpenseBreakdown {
  total: number;
  byCategory: ExpenseCategoryBreakdown[];
  largest: Largest;
  period: string;
}

interface Largest {
  name: string;
  value: number;
}

export interface RecentTransactionsAggregate {
  income: number;
  expense: number;
  net: number;
}

export interface RecentSummary {
  transactions: Transaction[];
  aggregate: RecentTransactionsAggregate;
}
