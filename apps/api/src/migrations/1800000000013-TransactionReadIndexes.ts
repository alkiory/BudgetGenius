import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * D2.2 follow-up — indexes for the two branches of
 * `BudgetRepository.sumExpenseAmountsByBudget`.
 *
 * The table only had its PK plus `IDX_transactions_budgetCategoryId`, so both
 * aggregations filtered `userId` through a sequential scan.
 *
 * - `(userId, date)` — legacy branch: rows scoped to the user and to each
 *   budget's inclusive `[startDate, endDate]` range.
 * - `(userId, budgetCategoryId)` — linked branch: rows scoped to the user and
 *   the FK used to join `budget_categories`.
 *
 * Both are plain `CREATE INDEX` (not CONCURRENTLY) on purpose: TypeORM runs a
 * migration inside a transaction and `CONCURRENTLY` is illegal there. The
 * table is small enough that the brief write lock is acceptable; if it ever
 * grows into the millions, build the indexes out of band first and keep this
 * migration as `IF NOT EXISTS`.
 *
 * `IF NOT EXISTS` makes a re-run (or a database where the indexes were created
 * manually during an incident) a no-op instead of a hard failure.
 */
export class TransactionReadIndexes1800000000013
  implements MigrationInterface
{
  name = 'TransactionReadIndexes1800000000013';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transactions_userId_date"
         ON "bg_public"."transactions" ("userId", "date")`,
    );
    await qr.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transactions_userId_budgetCategoryId"
         ON "bg_public"."transactions" ("userId", "budgetCategoryId")`,
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(
      `DROP INDEX IF EXISTS "bg_public"."IDX_transactions_userId_budgetCategoryId"`,
    );
    await qr.query(
      `DROP INDEX IF EXISTS "bg_public"."IDX_transactions_userId_date"`,
    );
  }
}
