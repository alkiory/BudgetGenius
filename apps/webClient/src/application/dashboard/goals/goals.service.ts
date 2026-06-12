import { HttpGoalRepository } from "@adapters/http/goal.repository";
import { Goal, goalProgress } from "@domain/dashboard/goals/goal.entity";

export const getGoals = async () => {
  return await HttpGoalRepository.getAll();
}

export const createGoal = async ({dto}: {dto: Omit<Goal, "id">}) => {
  return await HttpGoalRepository.createGoal({dto});
}

export const updateGoal = async ({goalId, dto}: {goalId: number, dto: Partial<Goal>}) => {
  return await HttpGoalRepository.updateGoal({goalId, dto});
}

export const updateGoalProgress = async ({goalId, amount}: goalProgress) => {
  return await HttpGoalRepository.updateGoalProgress({goalId, amount});
}

export const deleteGoal = async (id: number) => {
  return await HttpGoalRepository.deleteGoal(id);
}