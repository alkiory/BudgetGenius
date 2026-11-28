import {
  NewTransactionInput,
  TransactionPatch,
  TransactionTypeFilter,
} from "@domain/dashboard/transactions/transaction.entity";
import { TransactionRepository } from "@domain/dashboard/transactions/transactionRepository";
import api, { LONG_REQUEST_TIMEOUT_MS } from "@infrastructure/api.config";

// Phase 3 (T3.2): HttpTransactionRepository forwards an optional `type`
// query param to the backend. The backend applies a sign-convention
// where-clause only when `type` is present (MoreThan(0) / LessThan(0)),
// so existing callers (transactionPage) that pass no `type` continue
// to receive the full transaction list untouched.
export const HttpTransactionRepository: TransactionRepository = {
  async getAll(offset: number, limit: number, type?: TransactionTypeFilter) {
    const response = await api.get("/transactions", {
      params: { offset, limit, ...(type ? { type } : {}) },
    });
    return response.data;
  },

  async createTransaction({ dto }: { dto: NewTransactionInput }) {
    const response = await api.post("/transactions", dto);
    return response.data;
  },

  async importTransactions(transactions) {
    // One key per import, carried through the offline queue and every replay:
    // the API stores a receipt keyed by (userId, Idempotency-Key) inside the
    // same transaction as the rows, so a retry that arrives after a timeout
    // returns the stored outcome instead of inserting the rows twice.
    const response = await api.post(
      "/transactions/import",
      { transactions },
      {
        timeout: LONG_REQUEST_TIMEOUT_MS,
        headers: { "Idempotency-Key": crypto.randomUUID() },
      },
    );
    return response.data;
  },

  async updateTransaction({ dto }: { dto: TransactionPatch }) {
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
