import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { TransactionRepository } from '@adapters/dashboard/persistence/transaction.repository';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';
import { User } from '@domain/user/user.entity';
import { UserRepositoryImpl } from '@adapters/user/persistence/user.repository';
import { ImportTransactionItemDto } from '../dto/import-transactions.dto';

/**
 * Money is stored with two decimals. Historical rows written by the
 * removed currency-conversion flow can carry float residue
 * (`62.787499999999994`), so every write is normalized here rather than
 * trusting the client to round before sending.
 */
const roundToCents = (value: number): number =>
  Number(Number(value).toFixed(2));

/**
 * Calendar day (`YYYY-MM-DD`) of a DTO date. Transaction and budget dates are
 * Postgres `date` columns, so the comparison must not depend on the server
 * timezone: the ISO day the client sent is the day the user picked.
 */
const calendarDay = (value: Date | string): string =>
  typeof value === 'string'
    ? value.slice(0, 10)
    : value.toISOString().slice(0, 10);

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

    const budgetCategoryId = await this.resolveBudgetCategoryId(userId, {
      date: dto.date,
      category: dto.category,
      amount: dto.amount,
      explicitId: dto.budgetCategoryId,
    });

    // Normalize `recurrence` so the built object fully satisfies the entity's
    // nullable column contract — `Omit<Transaction, 'id'>` requires the field
    // (it can be `null`, but not `undefined`).
    const transaction = {
      ...dto,
      budgetCategoryId,
      amount: roundToCents(dto.amount),
      recurrence: dto.recurrence ?? null,
      user: { id: user.id } as User,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.transactionRepo.create(transaction);
  }

  /**
   * Imports up to 1,000 rows. `Idempotency-Key` makes retries safe:
   * the same key + payload replays the original outcome instead of
   * inserting the extract twice; a reused key with a different payload is
   * a 409. Without a key the legacy one-shot behaviour is preserved.
   *
   * Exact duplicate lines inside the same payload are dropped and reported
   * as `skippedDuplicates` (two identical coffees on different days are
   * still kept: the date is part of the identity).
   */
  async importTransactions(
    userId: number,
    items: ImportTransactionItemDto[],
    idempotencyKey?: string,
  ) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const normalized = items.map((item) => ({
      ...item,
      date: new Date(item.date),
      amount: roundToCents(item.amount),
      recurrence: item.recurrence ?? null,
    }));

    const identity = (item: (typeof normalized)[number]) =>
      JSON.stringify([
        calendarDay(item.date),
        item.description,
        item.category,
        item.amount,
        item.recurrence,
      ]);
    const deduped = [
      ...new Map(normalized.map((item) => [identity(item), item])).values(),
    ];
    const skippedDuplicates = normalized.length - deduped.length;

    if (idempotencyKey !== undefined) {
      const key = idempotencyKey.trim();
      if (!/^[A-Za-z0-9_-]{8,128}$/.test(key)) {
        throw new BadRequestException(
          'Idempotency-Key must be 8-128 characters of [A-Za-z0-9_-]',
        );
      }

      const payloadHash = createHash('sha256')
        .update(
          JSON.stringify(
            deduped.map((item) => ({
              date: calendarDay(item.date),
              description: item.description,
              category: item.category,
              amount: item.amount,
              recurrence: item.recurrence,
            })),
          ),
        )
        .digest('hex');

      const existing = await this.transactionRepo.findImportReceipt(
        userId,
        key,
      );
      if (existing) {
        if (existing.payloadHash !== payloadHash) {
          throw new ConflictException(
            'Idempotency-Key reused with a different payload',
          );
        }
        return {
          created: 0,
          createdCount: existing.createdCount,
          skippedDuplicates,
          replayed: true,
        };
      }

      try {
        await this.transactionRepo.insertImportWithReceipt({
          userId,
          items: deduped,
          idempotencyKey: key,
          payloadHash,
        });
      } catch (error) {
        // Concurrent retry won the unique constraint: replay its receipt if
        // the payload is identical, otherwise refuse the reused key.
        const code = (error as { driverError?: { code?: string } })
          ?.driverError?.code;
        if (code === '23505') {
          const winner = await this.transactionRepo.findImportReceipt(
            userId,
            key,
          );
          if (winner?.payloadHash === payloadHash) {
            return {
              created: 0,
              createdCount: winner.createdCount,
              skippedDuplicates,
              replayed: true,
            };
          }
          throw new ConflictException(
            'Idempotency-Key reused with a different payload',
          );
        }
        throw error;
      }

      // D2.2: one set-based UPDATE links every inserted row that has a
      // spending candidate (best window wins).
      await this.transactionRepo.linkBudgetCategories(userId);
      return {
        created: deduped.length,
        skippedDuplicates,
        replayed: false,
      };
    }

    await this.transactionRepo.createMany(deduped, userId);
    await this.transactionRepo.linkBudgetCategories(userId);
    return { created: deduped.length, skippedDuplicates, replayed: false };
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

    // D2.2: re-resolve the attribution from the values being saved. Editing
    // an expense into income (or into another category/day) must not keep a
    // link that no longer describes the row.
    const budgetCategoryId = await this.resolveBudgetCategoryId(userId, {
      date: dto.date,
      category: dto.category,
      amount: dto.amount,
      explicitId: dto.budgetCategoryId,
    });

    // `recurrence` is intentionally NOT seeded separately — the repo's
    // destructured-undefined guard preserves the existing value when the
    // dto omits the field (matches the partial-update contract on the
    // controller). The userId is forwarded to the repo so the WHERE clause
    // also filters — defence in depth: even if this service ever gets
    // called with a foreign id, the SQL will refuse it.
    const transaction = {
      ...dto,
      budgetCategoryId,
      ...(typeof dto.amount === 'number'
        ? { amount: roundToCents(dto.amount) }
        : {}),
      user: { id: userId } as User,
      updatedAt: new Date(),
    };
    return this.transactionRepo.update(transaction, userId);
  }
  /**
   * D2.2: decides the `budgetCategoryId` frozen with the row.
   *
   * - incomes (`amount >= 0`) never carry an attribution, even if a client
   *   sends one — they cannot consume a spending limit;
   * - an explicit id must belong to the caller (404 otherwise, without
   *   leaking whether it exists for somebody else);
   * - otherwise the server links only an unambiguous match (exactly one
   *   spending category for that day and name). Ambiguous rows stay `NULL`
   *   and readers keep the legacy window + name fallback.
   */
  private async resolveBudgetCategoryId(
    userId: number,
    input: {
      date: Date | string;
      category: string;
      amount: number;
      explicitId?: number;
    },
  ): Promise<number | null> {
    if (input.amount >= 0) {
      return null;
    }

    if (input.explicitId !== undefined && input.explicitId !== null) {
      const owned = await this.transactionRepo.findOwnedBudgetCategoryId(
        input.explicitId,
        userId,
      );
      if (owned === null) {
        throw new NotFoundException(
          `Budget category ${input.explicitId} not found`,
        );
      }
      return owned;
    }

    return this.transactionRepo.findBestBudgetCategoryId({
      userId,
      day: calendarDay(input.date),
      category: input.category,
    });
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

  /**
   * Deletes the requested transactions; ids the user does not own are ignored.
   * The bulk path is taken only when the request covers the whole owned set
   * (a same-size payload of foreign ids used to wipe the history).
   */
  async deleteAllTransactions(userId: number, transactionIds: number[]) {
    const user = await this.transactionRepo.findByUser(userId);
    const owned = user.transactions;
    const requested = new Set(transactionIds);

    const coversAllOwned =
      owned.length > 0 &&
      requested.size === owned.length &&
      owned.every((transaction) => requested.has(transaction.id));

    if (coversAllOwned) {
      await this.transactionRepo.deleteAllTransactions(userId);
      return {
        message: 'All transactions deleted successfully',
      };
    }

    const transactionsToDelete = owned.filter((transaction) =>
      requested.has(transaction.id),
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
