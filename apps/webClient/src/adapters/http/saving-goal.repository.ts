import { SavingGoal } from "@domain/dashboard/saving-goal/saving.entity";
import { SavingGoalRepository } from "@domain/dashboard/saving-goal/savingRepository";
import api from "@infrastructure/api.config";

export const HttpSavingRepository: SavingGoalRepository = {
  async getAll () {
    const response = await api.get('/saving-goal');
    return response.data;
  },

  async getById (id: number) {
    const response = await api.get(`/saving-goal/${id}`);
    return response.data;
  },

  async getByName (name: string) {
    const response = await api.get(`/saving-goal/name/${name}`);
    return response.data;
  },

  async createSavingGoal ({ dto }: { dto: Omit<SavingGoal, "id"> }) {
    const response = await api.post('/saving-goal', dto);
    return response.data;
  },

  async updateSavingGoal ({ dto }: { dto: Partial<SavingGoal> }) {
    const response = await api.put('/saving-goal', dto);
    return response.data;
  },

  async deleteSavingGoal (savingGoalId: number) {
    const response = await api.delete(`/saving-goal/${savingGoalId}`);
    return response.data;
  },

  async deleteAllSavingGoals () {
    const response = await api.delete(`/saving-goal/all`);
    return response.data;
  }
};