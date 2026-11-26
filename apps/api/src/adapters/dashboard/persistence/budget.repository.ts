import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget } from '@domain/dashboard/budget.entity';
import { BudgetCategory } from '@domain/dashboard/budget-category.entity';
import { Transaction } from '@domain/dashboard/transaction.entity';

export type ReconciliationRow = {
  id: number | string;
  date: string;
  description: string;
  category: string;
  amount: number | string;
  budgetId: number | string;
  budgetName: string;
  categoryId: number | string | null;
  categoryName: string | null;
};

@Injectable()
export class BudgetRepository {
  constructor(
    @InjectRepository(Budget)
    private readonly repo: Repository<Budget>,
    @InjectRepository(BudgetCategory)
    private readonly categoryRepo: Repository<BudgetCategory>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

  async countByUser(userId: number): Promise<number> {
    return this.repo.count({ where: { user: { id: userId } } });
  }

  async createBudget(budget: Omit<Budget, 'id'>): Promise<Budget> {
    const b = this.repo.create(budget);
    return this.repo.save(b);
  }

  async createBudgetCategory(
    category: Partial<BudgetCategory>,
  ): Promise<BudgetCategory> {
    const cat = this.categoryRepo.create(category);
    return this.categoryRepo.save(cat);
  }

  /**
   * Sum of expense transactions per budget and category, across every
   * budget owned by the user.
   *
   * Two disjoint sources, merged by `(budgetId, category)`:
   *
   * 1. **Linked rows** (D2.2, `budgetCategoryId` set): summed through the
   *    FK, so the attribution is frozen even if the category is renamed or
   *    the window edited later. Spending budgets only.
   * 2. **Legacy rows** (`budgetCategoryId IS NULL`): the pre-D2.2 window +
   *    case-insensitive name match, unchanged, so unlinked history keeps
   *    reading exactly as before.
   *
   * The legacy query excludes linked rows, so a transaction is never counted
   * twice even when its text still matches another category. The service
   * merges the result with each category's manual baseline.
   */
  async sumExpenseAmountsByBudget(
    userId: number,
  ): Promise<Array<{ budgetId: number; category: string; total: number }>> {
    const linked = await this.transactionRepo
      .createQueryBuilder('t')
      .innerJoin(BudgetCategory, 'bc', 'bc.id = t."budgetCategoryId"')
      .innerJoin(Budget, 'b', 'b.id = bc."budgetId"')
      .select('b.id', 'budgetId')
      .addSelect('LOWER(bc.name)', 'category')
      .addSelect('SUM(ABS(t.amount))', 'total')
      .where('t."userId" = :userId', { userId })
      .andWhere('t.amount < 0')
      .andWhere("b.type = 'spending'")
      .groupBy('b.id')
      .addGroupBy('LOWER(bc.name)')
      .getRawMany<{ budgetId: string; category: string; total: string }>();

    // Overlapping spending budgets are allowed since D2.2. An unlinked row
    // must still belong to exactly one of them, otherwise the legacy branch
    // would count it twice. `DISTINCT ON` picks the most specific budget:
    // narrowest window first (a monthly budget beats a yearly one), then the
    // most recent start, then the lowest id — deterministic regardless of
    // row order.
    const legacy = (await this.transactionRepo.query(
      `WITH attributed AS (
         SELECT DISTINCT ON (t."id", lower(t.category))
                t."id" AS transaction_id,
                b."id" AS budget_id,
                lower(t.category) AS category,
                t.amount
           FROM "bg_public"."transactions" AS t
           JOIN "bg_public"."budgets" AS b
             ON b."userId" = t."userId"
            AND b."type" = 'spending'
            AND t."date" BETWEEN b."startDate" AND b."endDate"
          WHERE t."userId" = $1
            AND t."amount" < 0
            AND t."budgetCategoryId" IS NULL
          ORDER BY t."id", lower(t.category),
                   (b."endDate" - b."startDate") ASC,
                   b."startDate" DESC,
                   b."id" ASC
       )
       SELECT budget_id AS "budgetId", category, SUM(ABS(amount)) AS total
         FROM attributed
        GROUP BY budget_id, category`,
      [userId],
    )) as Array<{ budgetId: string; category: string; total: string }>;

    const totals = new Map<
      string,
      { budgetId: number; category: string; total: number }
    >();
    for (const row of [...linked, ...legacy]) {
      const budgetId = Number(row.budgetId);
      const category = (row.category ?? '').toLowerCase();
      const key = `${budgetId}|${category}`;
      const current = totals.get(key);
      if (current) {
        current.total += Number(row.total) || 0;
      } else {
        totals.set(key, {
          budgetId,
          category,
          total: Number(row.total) || 0,
        });
      }
    }

    return [...totals.values()];
  }

  /**
   * Sum of deposits linked to each savings category.
   *
   * Savings progress is layered like spending: the stored `manualSpent`
   * baseline plus the ledger rows frozen to the category. Deriving the
   * ledger half makes deleting, editing or re-adding a deposit transaction
   * move the goal on the next read, with no second write to forget.
   */
  async sumLinkedSavingsByCategory(
    userId: number,
  ): Promise<Array<{ categoryId: number; total: number }>> {
    const rows = await this.transactionRepo
      .createQueryBuilder('t')
      .innerJoin(BudgetCategory, 'bc', 'bc.id = t."budgetCategoryId"')
      .innerJoin(Budget, 'b', 'b.id = bc."budgetId"')
      .select('bc.id', 'categoryId')
      .addSelect('SUM(ABS(t.amount))', 'total')
      .where('t."userId" = :userId', { userId })
      .andWhere('t.amount < 0')
      .andWhere("b.type = 'savings'")
      .groupBy('bc.id')
      .getRawMany<{ categoryId: string; total: string }>();

    return rows.map((row) => ({
      categoryId: Number(row.categoryId),
      total: Number(row.total) || 0,
    }));
  }

  async findByUser(userId: number): Promise<Budget[]> {
    return this.repo.find({
      where: { user: { id: userId } },
      relations: ['categories'],
    });
  }

  /**
   * Find a budget by id, scoped to the requesting user so we never leak
   * other users' budgets via numeric id guessing. Throws NotFoundException
   * if the id does not belong to the user — intentionally NOT 403 to avoid
   * leaking ownership existence (paper trail is the same as "not found").
   */
  async findById(id: number, userId: number): Promise<Budget> {
    const b = await this.repo.findOne({
      where: { id, user: { id: userId } },
      // `user` is deliberately NOT loaded: ownership is already enforced by
      // the where clause, and this result is returned verbatim by
      // `GET /budgets/:id`. Loading the relation serialized the owner's
      // bcrypt `password` hash and `refreshToken` in that response.
      relations: ['categories'],
    });
    if (!b) throw new NotFoundException(`Budget ${id} not found`);
    return b;
  }

  async findByBudgetId(
    budgetId: number,
    userId: number,
  ): Promise<BudgetCategory[]> {
    return this.categoryRepo.find({
      where: { budget: { id: budgetId, user: { id: userId } } },
    });
  }

  /**
   * Find a budget category by id, scoped to the requesting user through
   * the category → budget → user relation. NotFoundException on miss.
   */
  async getBudgetCategory(id: number, userId: number): Promise<BudgetCategory> {
    const c = await this.categoryRepo.findOne({
      where: { id, budget: { user: { id: userId } } },
      relations: ['budget'],
    });
    if (!c) throw new NotFoundException(`Budget category ${id} not found`);
    return c;
  }

  async findCategotyQuery(query: any): Promise<BudgetCategory[]> {
    return this.categoryRepo.find(query);
  }

  /**
   * Update a budget — defence in depth: pre-fetch with the userId filter
   * so a malicious caller cannot bypass `findById(..., userId)` upstream
   * and still reach this method with the row.
   */
  async updateBudget(budget: Partial<Budget>, userId: number): Promise<Budget> {
    if (budget.id != null) {
      const owned = await this.repo.findOne({
        where: { id: budget.id, user: { id: userId } },
      });
      if (!owned) {
        throw new NotFoundException(
          `Budget ${budget.id} not found or not owned by user`,
        );
      }
    }
    return this.repo.save(budget);
  }

  /**
   * Update a budget category — defence in depth: pre-fetch with the userId
   * filter through the category → budget → user relation chain. Throw
   * NotFoundException so service-level callers don't get to bypass the
   * ownership semantics by calling save() directly with a foreign id.
   */
  async updateBudgetCategory(
    category: Partial<BudgetCategory>,
    userId: number,
  ): Promise<BudgetCategory> {
    if (category.id != null) {
      const owned = await this.categoryRepo.findOne({
        where: { id: category.id, budget: { user: { id: userId } } },
      });
      if (!owned) {
        throw new NotFoundException(
          `Budget category ${category.id} not found or not owned by user`,
        );
      }
    }
    return this.categoryRepo.save(category);
  }

  /**
   * Delete a budget category by id — ownership is validated by the
   * service layer via `categoryRepo.getBudgetCategory(id, userId)` BEFORE
   * this method is invoked, so the repo only needs to operate on the
   * local `id` column.
   *
   * The previous signature was `deleteBudgetCategory(id, userId)` and
   * the body used `categoryRepo.delete({ id, budget: { user: { id } } })`.
   * That two-level nested relation criteria is NOT translated to a JOIN
   * by TypeORM's `Repository.delete()` — it tries to match a literal
   * `budget` column on `budget_categories`, which does not exist, so
   * the driver throws `QueryFailedError`. The custom
   * `EntityNotFoundExceptionFilter` catches `EntityNotFoundError` only;
   * `QueryFailedError` falls through to Nest's default filter and
   * surfaces as a 500. User-facing symptom: `DELETE /budgets/category/:id`
   * returned 500 even when the category legitimately belonged to the
   * caller. Fixed in v1.4.x by hoisting ownership validation into the
   * service (which uses `findOne` and DOES translate the nested WHERE
   * correctly via QueryBuilder).
   */
  async deleteBudgetCategory(id: number): Promise<void> {
    await this.categoryRepo.delete({ id });
  }

  /**
   * Historical reconciliation: unlinked expenses that fall inside at least
   * one spending-budget window. When windows overlap, the same deterministic
   * ranking used by the legacy attribution picks the winning budget
   * (narrowest window, then latest start, then lowest id), so the caller
   * gets one row per expense and a single, valid set of candidate
   * categories. Rows with a category name that already matches are still
   * returned; the service filters them out because they are already
   * attributed by the legacy fallback.
   */
  async findReconciliationRows(
    userId: number,
    transactionId?: number,
  ): Promise<ReconciliationRow[]> {
    return this.transactionRepo.query(
      `WITH ranked AS (
         SELECT t."id" AS transaction_id,
                to_char(t."date", 'YYYY-MM-DD') AS date,
                t."description" AS description,
                t."category" AS category,
                t."amount" AS amount,
                b."id" AS budget_id,
                b."name" AS budget_name,
                ROW_NUMBER() OVER (
                  PARTITION BY t."id"
                  ORDER BY (b."endDate" - b."startDate") ASC,
                           b."startDate" DESC,
                           b."id" ASC
                ) AS rn
           FROM "bg_public"."transactions" AS t
           JOIN "bg_public"."budgets" AS b
             ON b."userId" = t."userId"
            AND b."type" = 'spending'
            AND t."date" BETWEEN b."startDate" AND b."endDate"
          WHERE t."userId" = $1
            AND t."amount" < 0
            AND t."budgetCategoryId" IS NULL
            AND ($2::int IS NULL OR t."id" = $2)
       )
       SELECT r.transaction_id AS "id",
              r.date,
              r.description,
              r.category,
              r.amount,
              r.budget_id AS "budgetId",
              r.budget_name AS "budgetName",
              bc."id" AS "categoryId",
              bc."name" AS "categoryName"
         FROM ranked r
         LEFT JOIN "bg_public"."budget_categories" AS bc
           ON bc."budgetId" = r.budget_id
        WHERE r.rn = 1
        ORDER BY r.date DESC, r.transaction_id DESC, bc."name" ASC`,
      [userId, transactionId ?? null],
    );
  }

  /**
   * Freezes one reconciliation decision. The WHERE clause re-checks owner,
   * expense sign and "still unlinked" so a stale modal can never rewrite an
   * attribution that another request already made.
   */
  async setTransactionBudgetCategory(
    userId: number,
    transactionId: number,
    budgetCategoryId: number,
  ): Promise<boolean> {
    const result = await this.transactionRepo
      .createQueryBuilder()
      .update(Transaction)
      .set({
        budgetCategoryId,
        updatedAt: () => 'now()',
      })
      .where('"id" = :transactionId', { transactionId })
      .andWhere('"userId" = :userId', { userId })
      .andWhere('"amount" < 0')
      .andWhere('"budgetCategoryId" IS NULL')
      .execute();
    return (result.affected ?? 0) === 1;
  }

  /**
   * D2.2 assisted resolution — freeze the attribution of every still-unlinked
   * expense that matches `categoryName` inside the budget window. Called
   * before renaming a spending category so the historical rows keep counting
   * for it afterwards. Only negative amounts are linked: incomes never
   * consume a budget. Returns the number of rows linked.
   */
  async linkUnlinkedTransactionsToCategory(
    userId: number,
    budgetId: number,
    categoryName: string,
    categoryId: number,
  ): Promise<number> {
    const rows: Array<{ id: number }> = await this.transactionRepo.query(
      `UPDATE "bg_public"."transactions" AS t
          SET "budgetCategoryId" = $4
        WHERE t."userId" = $1
          AND t."amount" < 0
          AND t."budgetCategoryId" IS NULL
          AND lower(t.category) = lower($3)
          AND t."date" BETWEEN
              (SELECT b."startDate" FROM "bg_public"."budgets" AS b
                WHERE b."id" = $2 AND b."userId" = $1)
              AND
              (SELECT b."endDate" FROM "bg_public"."budgets" AS b
                WHERE b."id" = $2 AND b."userId" = $1)
        RETURNING t."id" AS id`,
      [userId, budgetId, categoryName, categoryId],
    );
    return rows.length;
  }

  /**
   * Delete a budget scoped to the user — same silent-on-miss semantics as
   * deleteBudgetCategory. The { id, user: { id: userId } } where-clause on
   * the Repository.delete() call scopes the delete to the owning user in a
   * single statement, so we never accidentally delete another user's budget.
   */
  async deleteBudget(id: number, userId: number): Promise<void> {
    await this.repo.delete({ id, user: { id: userId } });
  }
}
