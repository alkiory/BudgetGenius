import { HttpTransactionRepository } from "@adapters/http/transaction.repository";
import { Transaction } from "@domain/dashboard/transactions/transaction.entity";

export const getAllTransactions = async () => {
  return await HttpTransactionRepository.getAll(0, 50);
};

export const createTransaction = async ({
  dto,
}: {
  dto: Omit<Transaction, "id">;
}) => {
  return await HttpTransactionRepository.createTransaction({ dto });
};

export const updateTransaction = async ({
  dto,
}: {
  dto: Partial<Transaction>;
}) => {
  return await HttpTransactionRepository.updateTransaction({ dto });
};

export const deleteAllTransactions = async ({
  transactionId,
}: {
  transactionId: number[];
}) => {
  return await HttpTransactionRepository.deleteAllTransactions(transactionId);
};

export const deleteTransaction = async ({
  transactionId,
}: {
  transactionId: number;
}) => {
  return await HttpTransactionRepository.deleteTransaction(transactionId);
};
