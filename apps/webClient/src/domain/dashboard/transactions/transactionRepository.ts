import {
  NewTransactionInput,
  RootPromise,
  TransactionPatch,
  Transaction,
  TransactionTypeFilter,
} from "./transaction.entity";

// Phase 3 (T3.2): extended getAll to accept an optional `type` filter
// so the incomePage strangler-facade can request only positive-amount
// rows from the backend via `?type=income`. The optional shape keeps
// existing callers (transactionPage) untouched. The `TransactionTypeFilter`
// alias itself lives in `./transaction.entity` (sibling domain file)
// alongside `Category` and `IncomeRecurrence` — re-imported here so the
// port signature stays as the single source of truth.

export interface TransactionRepository {
  getAll(
    offset: number,
    limit: number,
    type?: TransactionTypeFilter,
  ): Promise<RootPromise>;
  createTransaction({
    dto,
  }: {
    dto: NewTransactionInput;
  }): Promise<Transaction>;
  updateTransaction({
    dto,
  }: {
    dto: TransactionPatch;
  }): Promise<Transaction>;
  deleteTransaction(transactionId: number): Promise<void>;
  deleteAllTransactions(transactionId: number[]): Promise<void>;
}
