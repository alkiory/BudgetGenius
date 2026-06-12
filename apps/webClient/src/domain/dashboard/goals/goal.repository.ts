import { Goal, goalProgress } from "./goal.entity";

export interface GoalRepository {
  getAll(): Promise<Goal[]>;
  createGoal({dto}: {dto: Omit<Goal, "id">}): Promise<Goal>;
  updateGoal({goalId, dto}: {goalId: number, dto: Partial<Goal>}): Promise<Goal>;
  deleteGoal(id: number): Promise<void>;
  updateGoalProgress({amount}: goalProgress): Promise<Goal>;
}