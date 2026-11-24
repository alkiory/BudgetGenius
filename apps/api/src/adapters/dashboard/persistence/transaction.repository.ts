import { Transaction } from '@domain/dashboard/transaction.entity';
import { Budget } from '@domain/dashboard/budget.entity';
import { BudgetCategory } from '@domain/dashboard/budget-category.entity';
import { User } from '@domain/user/user.entity';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';

@Injectable()
export class TransactionRepository {
  constructor(
    @InjectRepository(Transaction)
    private readonly repo: Repository<Transaction>,
    @InjectRepository(BudgetCategory)
    private readonly categoryRepo: Repository<BudgetCategory>,
  ) {}

  async create(
    transaction: Partial<Omit<Transaction, 'id'>>,
  ): Promise<Transaction> {
    // Match the service's spread-shape builder, which may carry `recurrence`
    // as either a value, null, or absent. Defaults still land via the
    // nullable column at the DB layer.
    const newTransaction = this.repo.create(transaction);
    return this.repo.save(newTransaction);
  }

  async createMany(
    transactions: Array<{
      date: Date;
      description: string;
      category: string;
      amount: number;
      recurrence: string | null;
    }>,
    userId: number,
  ): Promise<void> {
    if (!transactions.length) return;
    const now = new Date();
    await this.repo.insert(
      transactions.map((transaction) => ({
        ...transaction,
        user: { id: userId },
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  /**
   * D2.2 — the **spending** budget category this expense belongs to, or
   * `null` when no spending category matches the day and name.
   *
   * Overlapping spending budgets are allowed: when several candidates exist,
   * the most specific one wins — narrowest window first (monthly beats
   * yearly), then the most recent start, then the lowest id. The ranking is
   * the same one used by the legacy read fallback, so a row is never
   * counted by two budgets and re-reading the budget is deterministic.
   * Savings budgets are excluded: they are manual goals and never consume
   * transactions.
   */
  async findBestBudgetCategoryId({
    userId,
    day,
    category,
  }: {
    userId: number;
    day: string;
    category: string;
  }): Promise<number | null> {
    const rows: Array<{ id: number }> = await this.categoryRepo.query(
      `SELECT bc."id"
         FROM "bg_public"."budget_categories" AS bc
         JOIN "bg_public"."budgets" AS b ON b."id" = bc."budgetId"
        WHERE b."userId" = $1
          AND b."type" = 'spending'
          AND $2::date BETWEEN b."startDate" AND b."endDate"
          AND lower(bc."name") = lower($3)
        ORDER BY (b."endDate" - b."startDate") ASC,
                 b."startDate" DESC,
                 bc."id" ASC
        LIMIT 1`,
      [userId, day, category],
    );
    return rows[0] ? Number(rows[0].id) : null;
  }

  /** Ownership check for an explicitly chosen budget category. */
  async findOwnedBudgetCategoryId(
    categoryId: number,
    userId: number,
  ): Promise<number | null> {
    const row = await this.categoryRepo
      .createQueryBuilder('bc')
      .innerJoin(Budget, 'b', 'b.id = bc."budgetId"')
      .select('bc.id', 'id')
      .where('bc.id = :categoryId', { categoryId })
      .andWhere('b."userId" = :userId', { userId })
      .getRawOne<{ id: number }>();
    return row ? Number(row.id) : null;
  }

  /**
   * D2.2 catch-up linker for write paths that insert many rows at once
   * (imports). Runs one set-based UPDATE and links every still-`NULL` row
   * that has at least one spending candidate, choosing the most specific
   * one with the same ranking as `findBestBudgetCategoryId`. Returns how
   * many rows received a link.
   */
  async linkBudgetCategories(userId: number): Promise<number> {
    const rows: Array<{ id: number }> = await this.repo.query(
      `WITH candidates AS (
         SELECT t."id" AS "transactionId",
                bc."id" AS "budgetCategoryId",
                ROW_NUMBER() OVER (
                  PARTITION BY t."id"
                  ORDER BY (b."endDate" - b."startDate") ASC,
                           b."startDate" DESC,
                           bc."id" ASC
                ) AS rn
           FROM "bg_public"."transactions" AS t
           JOIN "bg_public"."budgets" AS b
             ON b."userId" = t."userId"
            AND b."type" = 'spending'
            AND t."date" BETWEEN b."startDate" AND b."endDate"
           JOIN "bg_public"."budget_categories" AS bc
             ON bc."budgetId" = b."id"
            AND lower(bc."name") = lower(t."category")
          WHERE t."userId" = $1
            AND t."budgetCategoryId" IS NULL
            AND t."amount" < 0
       )
       UPDATE "bg_public"."transactions" AS t
          SET "budgetCategoryId" = c."budgetCategoryId"
         FROM candidates AS c
        WHERE c."transactionId" = t."id"
          AND c."rn" = 1
       RETURNING t."id" AS id`,
      [userId],
    );
    return rows.length;
  }

  /** Durable idempotency receipt for an import retry. */
  async findImportReceipt(
    userId: number,
    idempotencyKey: string,
  ): Promise<{ payloadHash: string; createdCount: number } | null> {
    const rows: Array<{ payloadHash: string; createdCount: number }> =
      await this.repo.query(
        `SELECT "payloadHash", "createdCount"
           FROM "bg_public"."transaction_import_receipts"
          WHERE "userId" = $1 AND "idempotencyKey" = $2`,
        [userId, idempotencyKey],
      );
    return rows[0] ?? null;
  }

  /**
   * Inserts the imported rows and their receipt atomically. If the unique
   * `(userId, idempotencyKey)` constraint fires, the transaction rolls back
   * and the caller re-reads the winning receipt.
   */
  async insertImportWithReceipt({
    userId,
    items,
    idempotencyKey,
    payloadHash,
  }: {
    userId: number;
    items: Array<{
      date: Date;
      description: string;
      category: string;
      amount: number;
      recurrence: string | null;
    }>;
    idempotencyKey: string;
    payloadHash: string;
  }): Promise<number> {
    return this.repo.manager.transaction(async (manager) => {
      const now = new Date();
      if (items.length > 0) {
        await manager.getRepository(Transaction).insert(
          items.map((item) => ({
            ...item,
            user: { id: userId },
            createdAt: now,
            updatedAt: now,
          })),
        );
      }
      await manager.query(
        `INSERT INTO "bg_public"."transaction_import_receipts"
           ("userId", "idempotencyKey", "payloadHash", "createdCount")
         VALUES ($1, $2, $3, $4)`,
        [userId, idempotencyKey, payloadHash, items.length],
      );
      return items.length;
    });
  }

  async findByUser(userId: number): Promise<User> {
    const userRepo = this.repo.manager.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: userId },
      relations: ['transactions'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  async findOne(id: number, userId: number): Promise<Transaction> {
    const transaction = await this.repo.findOne({
      where: { id, user: { id: userId } },
      relations: ['user'],
    });
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }
    return transaction;
  }

  async update(
    data: Partial<Transaction> & { id: number },
    userId: number,
  ): Promise<Transaction> {
    const {
      id,
      date,
      description,
      category,
      amount,
      recurrence,
      budgetCategoryId,
    } = data;
    // findOneOrFail with the userId where-clause: throws
    // EntityNotFoundError if the row does not belong to the user — the
    // service layer lets this bubble up wrapped as NotFoundException so
    // the controller returns a clean 404 (not a 403, on purpose: avoid
    // leaking ownership existence).
    const transaction = await this.repo.findOneOrFail({
      where: { id, user: { id: userId } },
    });
    if (date !== undefined) {
      transaction.date = date;
    }
    transaction.description = description;
    transaction.category = category;
    transaction.amount = amount;
    // Partial-update contract: omitted = preserve, explicit value = overwrite.
    // The `undefined` check is critical — a default parameter (e.g. `= null`)
    // would coerce it to null and silently wipe an existing recurrence.
    if (recurrence !== undefined) {
      transaction.recurrence = recurrence;
    }
    // D2.2: the service always sends the key (number or null), so an update
    // that turns an expense into income clears a stale attribution instead
    // of keeping it silently.
    if (budgetCategoryId !== undefined) {
      transaction.budgetCategoryId = budgetCategoryId;
    }
    await this.repo.save(transaction);
    return transaction;
  }
  async delete(id: number, userId: number): Promise<boolean> {
    // Where-clause DELETE scopes the row to the owning user; foreign ids
    // become no-ops (affected = 0). Caller decides what "no-op" means
    // (the service treats it as "not found" and returns false).
    const result = await this.repo.delete({ id, user: { id: userId } });
    return (result.affected ?? 0) > 0;
  }

  async deleteAllTransactions(userId: number) {
    try {
      const user = await this.findByUser(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (user.transactions.length === 0) {
        return { message: 'No transactions found for this user' };
      }
      const transactions = user.transactions;
      await this.repo.remove(transactions);
    } catch (error) {
      console.error('Error deleting transactions:', error);
      throw new InternalServerErrorException('Error deleting transactions');
    }
  }

  async findAndCount({
    offset,
    limit,
    userId,
    type,
  }: {
    offset: number;
    limit: number;
    userId: number;
    type?: 'income' | 'expense';
  }) {
    // Phase 3 (T3.3): apply a sign-convention where-clause only when the
    // controller forwarded an explicit `type` filter. Omitting the key
    // when `type` is undefined preserves every existing caller's
    // behavior (transactionPage passes no `type` and expects the full
    // unfiltered list).
    const where: Record<string, unknown> = { user: { id: userId } };
    if (type === 'income') {
      where.amount = MoreThan(0);
    } else if (type === 'expense') {
      where.amount = LessThan(0);
    }

    const [transactions, total] = await this.repo.findAndCount({
      where,
      skip: offset,
      take: limit,
      order: {
        date: 'DESC',
      },
    });
    return {
      transactions,
      meta: {
        total,
        offset,
        limit,
        nextOffset: offset + limit < total ? offset + limit : null,
      },
    };
  }
}
