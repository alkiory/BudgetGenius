import { Goal, goalProgress } from "@domain/dashboard/goals/goal.entity";
import { GoalRepository } from "@domain/dashboard/goals/goal.repository";
import api from "@infrastructure/api.config";

export const HttpGoalRepository: GoalRepository = {
  async getAll() {
    const response = await api.get('/goals');
    return response.data;
  },
  async createGoal({dto}: {dto: Omit<Goal, "id">}) {
    const response = await api.post('/goals', dto);
    return response.data;
  },
  async updateGoal({goalId, dto}: {goalId: number, dto: Partial<Goal>}) {
    const response = await api.put(`/goals/${goalId}`, {dto});
    return response.data;
  },
  async deleteGoal(id: number) {
    const response = await api.delete(`/goals/${id}`);
    return response.data;
  },

  async updateGoalProgress({ goalId, amount }: goalProgress) {
    const  body = { amount };
    const response = await api.patch(`/goals/${goalId}/progress`, body);
    return response.data;
  },
};