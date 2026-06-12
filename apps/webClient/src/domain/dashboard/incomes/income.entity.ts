import { Currency } from "firebase/analytics";

export type IncomeCategory =
  | 'Salary'
  | 'Freelance'
  | 'Investments'
  | 'Rental'
  | 'Business'
  | 'Gifts'
  | 'Refunds'
  | 'Other';

export const INCOME_CATEGORIES = [
  'All',
  'Salary',
  'Freelance',
  'Investments',
  'Rental',
  'Business',
  'Gifts',
  'Refunds',
  'Other',
];

export type IncomeRecurrence =
  | 'One-time'
  | 'Daily'
  | 'Bi‑weekly'
  | 'Monthly'
  | 'Quarterly'
  | 'Annually';

export const INCOME_RECURRENCES = [
  'One-time',
  'Daily',
  'Bi-weekly',
  'Monthly',
  'Quarterly',
  'Annually',
];

export type Income = {
  id: number;
  date: Date;
  description: string;
  category: IncomeCategory;
  currency: Currency;
  amount: number;
  recurrence: IncomeRecurrence;
  createdAt: Date;
  updatedAt: Date;
};

export type Category = typeof INCOME_CATEGORIES[number]
export type Recurrence = typeof INCOME_RECURRENCES[number]

export interface RootPromise {
  incomes: Income[]
  meta: Meta
}

export interface Meta {
  total: number
  offset: string
  limit: string
  nextOffset: unknown
}