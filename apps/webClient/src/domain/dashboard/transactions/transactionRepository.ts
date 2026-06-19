import { RootPromise, Transaction } from "./transaction.entity";

// Phase 3 (T3.2): extended getAll to accept an optional `type` filter
// so the incomePage strangler-facade can request only positive-amount
// rows from the backend via `?type=income`. The optional shape keeps
// existing callers (transactionPage) untouched.
export type TransactionTypeFilter = "income" | "expense";

export interface TransactionRepository {
  getAll(
    offset: number,
    limit: number,
    type?: TransactionTypeFilter,
  ): Promise<RootPromise>;
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
