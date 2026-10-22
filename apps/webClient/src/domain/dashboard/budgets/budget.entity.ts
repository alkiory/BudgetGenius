export const BUDGET_TYPE_OPTIONS = ["spending", "savings"] as const;
export type BudgetType = (typeof BUDGET_TYPE_OPTIONS)[number];

/**
 * Planning-friendly subset of the transaction categories. Filter sentinels
 * (`All`), income-only categories (Salary, Freelance, …), and duplicates
 * (Rental overlaps Rent) are intentionally excluded. Legacy budgets that
 * already use an excluded name still render it via the row's fallback
 * option, so editing never loses data.
 */
const EXPENSE_CATEGORY_OPTIONS = [
  "Housing",
  "Food",
  "Transportation",
  "Entertainment",
  "Education",
  "Medical",
  "Rent",
  "Dining",
  "Groceries",
  "Shopping",
  "Utilities",
  "Healthcare",
  "Other",
  "Gifts",
] as const;

export const BUDGET_CATEGORY_OPTIONS: string[] = [
  ...EXPENSE_CATEGORY_OPTIONS,
];

export const periodTranslationKey = (period: string): string =>
  period === "Bi-weekly"
    ? "biWeekly"
    : period === "One-time"
    ? "oneTime"
    : period.toLowerCase();

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
  /** Effective total exposed by the API: manual + transactions. */
  spent: number;
  /** Manual baseline ("Añadir gasto" / deposits). */
  manualSpent?: number;
  /** Expense transactions matched to this category in the budget window. */
  transactionSpent?: number;
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
  /** `spending` caps expenses; `savings` tracks money put aside. */
  type?: BudgetType;
  startDate: Date;
  endDate: Date;
  totalAllocated: number;
  totalSpent: number;
  categories: BudgetCategory[];
}
