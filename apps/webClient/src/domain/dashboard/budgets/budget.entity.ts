export const BUDGET_TYPE_OPTIONS = ["spending", "savings"] as const;
export type BudgetType = (typeof BUDGET_TYPE_OPTIONS)[number];

/**
 * Planning-friendly subset of the transaction categories. Filter sentinels
 * (`All`), income-only categories (Salary, Freelance, …), and duplicates
 * (Rental overlaps Rent) are intentionally excluded. Legacy budgets that
 * already use an excluded name still render it via the row's fallback
 * option, so editing never loses data.
 *
 * Kept deliberately short: this is a picker, not an inventory. Anything else
 * is added by the user as a transaction category ("Import categories").
 */
const EXPENSE_CATEGORY_OPTIONS = [
  "Housing",
  "Food",
  "Transportation",
  "Groceries",
  "Dining",
  "Utilities",
  "Shopping",
  "Entertainment",
  "Healthcare",
  "Other",
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
}

export interface ReconciliationCandidate {
  id: number;
  name: string;
}

/** An unlinked expense that needs a manual budget-category assignment. */
export interface ReconciliationItem {
  id: number;
  date: string;
  description: string;
  category: string;
  amount: number;
  budgetId: number;
  budgetName: string;
  candidates: ReconciliationCandidate[];
}

export interface ReconciliationQueue {
  total: number;
  items: ReconciliationItem[];
}

export interface Budget {
  id: string | number;
  name: string;
  period: string;
  /** `spending` caps expenses; `savings` tracks money put aside. */
  type?: BudgetType;
  /** Stable identifier for system-recognized goals (e.g. `emergency-fund`). */
  goalKey?: string | null;
  startDate: Date;
  endDate: Date;
  totalAllocated: number;
  totalSpent: number;
  categories: BudgetCategory[];
}
