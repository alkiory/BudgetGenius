export const PERIOD_OPTIONS = ["One-time", "Daily", "Weekly", "Bi-weekly", "Monthly", "Quarterly", "Yearly"]

export interface BudgetCategory {
  budgetId: string | number | undefined
  id?: string | number |undefined
  name: string
  allocated: number
  spent: number
}

export interface Budget {
  id: string | number
  name: string
  period: string
  startDate: Date
  endDate: Date
  totalAllocated: number
  totalSpent: number
  categories: BudgetCategory[]
}