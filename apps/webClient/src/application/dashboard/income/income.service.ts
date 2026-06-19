import { HttpTransactionRepository } from "@adapters/http/transaction.repository";
import { Transaction } from "@domain/dashboard/transactions/transaction.entity";

export const getIncomes = async (offset?: number, limit?: number) => {
  if (!offset) offset = 0;
  if (!limit) limit = 50;
  return await HttpTransactionRepository.getAll(offset, limit);
};

export const createIncome = async ({
  dto,
}: {
  dto: Omit<Transaction, "id">;
}) => {
  return await HttpTransactionRepository.createTransaction({ dto });
};

export const updateIncome = async ({ dto }: { dto: Partial<Transaction> }) => {
  return await HttpTransactionRepository.updateTransaction({ dto });
};

export const deleteIncome = async ({
  transactionId,
}: {
  transactionId: number;
}) => {
  return await HttpTransactionRepository.deleteTransaction(transactionId);
};

export const deleteAllIncomes = async ({
  transactionId,
}: {
  transactionId: number[];
}) => {
  return await HttpTransactionRepository.deleteAllTransactions(transactionId);
};
