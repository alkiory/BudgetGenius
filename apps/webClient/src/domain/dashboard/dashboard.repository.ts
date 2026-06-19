import {
  DashboardOverview,
  ExpenseBreakdown,
  RecentSummary,
} from "./dashboard.entity";

export interface DashboardRepository {
  getAll(): Promise<DashboardOverview>;
  getExpenseCategorys(): Promise<ExpenseBreakdown>;
  getRecentSummary(limit?: number): Promise<RecentSummary>;
}
