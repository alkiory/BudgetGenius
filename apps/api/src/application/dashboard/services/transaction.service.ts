import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { TransactionRepository } from '@adapters/dashboard/persistence/transaction.repository';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';
import { User } from '@domain/user/user.entity';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';

/**
 * Money is stored with two decimals. Historical rows written by the
 * removed currency-conversion flow can carry float residue
 * (`62.787499999999994`), so every write is normalized here rather than
 * trusting the client to round before sending.
 */
const roundToCents = (value: number): number =>
  Number(Number(value).toFixed(2));

@Injectable()
export class TransactionService {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly userRepo: UserRepositoryImpl,
  ) {}

  async createTransaction(
    userId: number,
    dto: Omit<CreateTransactionDto, 'id'>,
  ) {
    // `findByUser` throws NotFoundException if user doesn't exist, so no need for a null check
    const user = await this.transactionRepo.findByUser(userId);

    // Normalize `recurrence` so the built object fully satisfies the entity's
    // nullable column contract — `Omit<Transaction, 'id'>` requires the field
    // (it can be `null`, but not `undefined`).
    const transaction = {
      ...dto,
      amount: roundToCents(dto.amount),
      recurrence: dto.recurrence ?? null,
      user: { id: user.id } as User,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.transactionRepo.create(transaction);
  }

  async getTransactionsByUser({
    userId,
    offset,
    limit,
    type,
  }: {
    userId: number;
    offset: number;
    limit: number;
    type?: 'income' | 'expense';
  }) {
    // Verify user exists — `findById` returns null if not found
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Query the database directly instead of relying on an eager-loaded relation.
    // Phase 3 (T3.3): forward the optional `type` filter to the repository,
    // which applies a sign-convention where-clause (MoreThan(0) / LessThan(0))
    // when present. Omitted type returns all transactions — preserves
    // existing callers (transactionPage) unchanged.
    return this.transactionRepo.findAndCount({
      offset,
      limit,
      userId,
      type,
    });
  }

  async updateTransaction(
    userId: number,
    dto: Omit<UpdateTransactionDto, 'createdAt'>,
  ) {
    // Verify user exists - `findByUser` throws NotFoundException if not
    await this.transactionRepo.findByUser(userId);

    // `recurrence` is intentionally NOT seeded separately — the repo's
    // destructured-undefined guard preserves the existing value when the
    // dto omits the field (matches the partial-update contract on the
    // controller). The userId is forwarded to the repo so the WHERE clause
    // also filters — defence in depth: even if this service ever gets
    // called with a foreign id, the SQL will refuse it.
    const transaction = {
      ...dto,
      ...(typeof dto.amount === 'number'
        ? { amount: roundToCents(dto.amount) }
        : {}),
      user: { id: userId } as User,
      updatedAt: new Date(),
    };
    return this.transactionRepo.update(transaction, userId);
  }
  async deleteTransaction(
    transactionId: number,
    userId: number,
  ): Promise<boolean> {
    // The repo's `delete` performs a WHERE-scoped DELETE and reports
    // affected row count, so a foreign-id attempt is a no-op (returns
    // false). No need for an explicit `findOne + ownership` round-trip
    // here.
    return this.transactionRepo.delete(transactionId, userId);
  }

  async deleteAllTransactions(userId: number, transactions: any) {
    const user = await this.transactionRepo.findByUser(userId);

    if (transactions.length === user.transactions.length) {
      await this.transactionRepo.deleteAllTransactions(userId);
      return {
        message: 'All transactions deleted successfully',
      };
    }
    const transactionsToDelete = user.transactions.filter(
      (transaction) => transactions?.transactions.includes(transaction.id),
    );

    if (transactionsToDelete.length === 0) {
      return {
        message: 'No transactions to delete',
      };
    }

    // The repo's `delete` is now scoped by userId, so each row also gets
    // a WHERE userId = :userId check at SQL level. Foreign ids cannot
    // sneak through this loop even if `transactionsToDelete` is somehow
    // cross-contaminated.
    await Promise.all(
      transactionsToDelete.map((transaction) =>
        this.transactionRepo.delete(transaction.id, userId),
      ),
    );

    return {
      message: 'Selected transactions deleted successfully',
    };
  }
}
