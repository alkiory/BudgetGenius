import { DashboardOverview, ExpenseBreakdown } from "./dashboard.entity";

export interface DashboardRepository {
  getAll(): Promise<DashboardOverview>,
  getExpenseCategorys(): Promise<ExpenseBreakdown>
}