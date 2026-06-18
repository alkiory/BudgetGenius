export type DashboardOverview = {
  balance: number;
  income: number;
  expenses: number;
  period: Date;
};

export interface ExpenseBreakdown {
  total: number;
  byCategory: any[];
  largest: Largest;
  period: string;
}

interface Largest {
  name: string;
  value: number;
}
