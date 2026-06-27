import { HttpTransactionRepository } from "@adapters/http/transaction.repository";
import {
  NewTransactionInput,
  TransactionPatch,
} from "@domain/dashboard/transactions/transaction.entity";

export const getAllTransactions = async () => {
  return await HttpTransactionRepository.getAll(0, 50);
};

export const createTransaction = async ({
  dto,
}: {
  dto: NewTransactionInput;
}) => {
  return await HttpTransactionRepository.createTransaction({ dto });
};

export const updateTransaction = async ({
  dto,
}: {
  dto: TransactionPatch;
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
