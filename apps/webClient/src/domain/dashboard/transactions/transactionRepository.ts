import { RootPromise, Transaction } from "./transaction.entity";

export interface TransactionRepository {
  getAll(offset: number, limit: number): Promise<RootPromise>;
  createTransaction({
    dto,
  }: {
    dto: Omit<Transaction, "id">;
  }): Promise<Transaction>;
  updateTransaction({
    dto,
  }: {
    dto: Partial<Transaction>;
  }): Promise<Transaction>;
  deleteTransaction(transactionId: number): Promise<void>;
  deleteAllTransactions(transactionId: number[]): Promise<void>;
}
