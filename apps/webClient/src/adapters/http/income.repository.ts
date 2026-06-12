import { Income } from "@domain/dashboard/incomes/income.entity";
import { IncomeRepository } from "@domain/dashboard/incomes/income.repository";
import api from "@infrastructure/api.config";

export const HttpIncomeRepository: IncomeRepository = {
  async getAll(offset: number, limit: number) {
    const response = await api.get('/incomes', {
      params: { offset, limit },
    });
    return response.data;
  },

  async createIncome({ dto }: { dto: Omit<Income, "id"> }) {
    const response = await api.post('/incomes', dto);
    return response.data;
  },

  async updateIncome({ dto }: { dto: Partial<Income> }) {
   const response = await api.put(`/incomes/${dto.id}`, dto);
    return response.data;
  },

  async deleteIfOwned(id: number) {
   const response = await api.delete(`/incomes/${id}`);
    return response.data;
  },

  async deleteAll() {
   const response = await api.delete('/incomes');
    return response.data;
  }
}