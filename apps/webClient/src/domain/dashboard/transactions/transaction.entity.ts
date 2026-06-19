import { Currency } from "@presentation/utils/currencyService";

// Phase 3 (Income → Transaction strangler facade):
// `recurrence` is the column Phase 1 added to the backend entity. Legacy
// expense rows are nullable (null = non-recurring); migrated income rows
// from `incomes` carry the original Income.recurrence value.
export type Transaction = {
  id: number;
  date: Date;
  description: string;
  category: string;
  amount: number;
  currency: Currency;
  recurrence: string | null;
};

// Phase 3 (Income → Transaction strangler facade):
// Backend `transactions.recurrence` accepts arbitrary strings for legacy
// compatibility, but the FRONTEND form surface a fixed enum so the filter
// chips, recurrence pickers, and `Bi-weekly` casing are all consistent.
// T3.5 + T3.6 reference this constant.
export const INCOME_RECURRENCES = [
  "One-time",
  "Daily",
  "Weekly",
  "Bi-weekly",
  "Monthly",
  "Quarterly",
  "Annually",
] as const;

export type IncomeRecurrence = (typeof INCOME_RECURRENCES)[number];

export interface RootPromise {
  transactions: Transaction[];
  meta: Meta;
}

export interface Meta {
  total: number;
  offset: string;
  limit: string;
  nextOffset: unknown;
}

// Phase 3 (T3.1): added categories that were Income-only and now flow
// through the unified transactions domain. Order preserved for "All" first
// so the existing filter chip rendering doesn't shift. Existing entries
// (Salary, Gifts, Income) are kept to maintain parity with legacy rows.
export const TRANSACTION_CATEGORIES = [
  "All",
  "Housing",
  "Food",
  "Transportation",
  "Entertainment",
  "Education",
  "Medical",
  "Rent",
  "Salary",
  "Dining",
  "Groceries",
  "Shopping",
  "Utilities",
  "Healthcare",
  "Income",
  "Freelance",
  "Investments",
  "Rental",
  "Business",
  "Refunds",
  "Other",
  "Gifts",
];

export type Category = (typeof TRANSACTION_CATEGORIES)[number];
