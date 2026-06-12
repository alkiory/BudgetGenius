import { Currency } from "@presentation/utils/currencyService";

export type Transaction = {
  id: number;
  date: Date;
  description: string;
  category: string;
  amount: number;
  currency: Currency;
  status: "Pending" | "Completed" | "Cancelled";
};

export interface RootPromise {
  transactions: Transaction[]
  meta: Meta
}

export interface Meta {
  total: number
  offset: string
  limit: string
  nextOffset: unknown
}

export const TRANSACTION_CATEGORIES = [
  "All", "Housing", "Food", "Transportation", "Entertainment",
  "Education", "Medical", "Rent", "Salary", "Dining", "Groceries",
  "Shopping", "Utilities", "Healthcare", "Income", "Other", "Gifts",
]

export const TRANSACTION_STATUSES = ["All", "Pending", "Completed", "Cancelled"];


export type Category = typeof TRANSACTION_CATEGORIES[number]