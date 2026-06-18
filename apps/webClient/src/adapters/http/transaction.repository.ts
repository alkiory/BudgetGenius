import { Transaction } from "@domain/dashboard/transactions/transaction.entity";
import { TransactionRepository } from "@domain/dashboard/transactions/transactionRepository";
import api from "@infrastructure/api.config";

export const HttpTransactionRepository: TransactionRepository = {
  async getAll(offset: number, limit: number) {
    const response = await api.get("/transactions", {
      params: { offset, limit },
    });
    return response.data;
  },

  async createTransaction({ dto }: { dto: Omit<Transaction, "id"> }) {
    const response = await api.post("/transactions", dto);
    return response.data;
  },

  async updateTransaction({ dto }: { dto: Partial<Transaction> }) {
    const response = await api.put("/transactions", dto);
    return response.data;
  },

  async deleteTransaction(transactionId: number) {
    const response = await api.delete(`/transactions/${transactionId}`);
    return response.data;
  },

  async deleteAllTransactions(transactions: number[]) {
    const response = await api.delete(`/transactions/all`, {
      data: { transactions },
    });
    return response.data;
  },
};
