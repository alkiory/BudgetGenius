export const PERIOD_OPTIONS = [
  "One-time",
  "Daily",
  "Weekly",
  "Bi-weekly",
  "Monthly",
  "Quarterly",
  "Yearly",
];

export interface BudgetCategory {
  budgetId: string | number | undefined;
  id?: string | number | undefined;
  name: string;
  allocated: number;
  spent: number;
  // Mirror of api/src/domain/dashboard/budget-category.entity.ts's
  // `currency` column (added in migration 1800000000004 with default
  // 'USD'). Optional because pre-migration rows either come back without
  // it (older API responses) or will be normalised to 'USD' on the fly.
  // The display layer casts this to `Currency` and falls back to "USD"
  // when undefined so legacy rows still render coherently.
  currency?: string;
}

export interface Budget {
  id: string | number;
  name: string;
  period: string;
  startDate: Date;
  endDate: Date;
  totalAllocated: number;
  totalSpent: number;
  categories: BudgetCategory[];
}
