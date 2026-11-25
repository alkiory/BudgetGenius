import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * D2.2 (Wave 1) — explicit transaction → budget category attribution.
 *
 * Until now a transaction was attributed to a budget only at read time, by
 * intersecting its date with the budget window and comparing its free-text
 * `category` with `budget_categories.name`. That made history move: renaming
 * a category dropped past expenses from it, and editing a budget window
 * silently re-attributed rows.
 *
 * `transactions.budgetCategoryId` freezes the attribution at write time:
 *
 * - `NULL` means "not attributed" (income, ambiguous category, no budget).
 *   Readers keep the legacy window+name fallback for those rows, so this
 *   migration does not change a single number.
 * - The FK is `ON DELETE SET NULL`: deleting a category degrades that row to
 *   the legacy fallback instead of deleting the ledger entry.
 * - Backfill only links rows with **exactly one** candidate and only against
 *   **spending** budgets. Savings are manual goals and never consume
 *   transactions (see D2 / migration 008), so a savings category is never a
 *   candidate. Ambiguous rows stay `NULL` on purpose: guessing would invent
 *   history.
 *
 * The whole `up()` is idempotent: column, constraint and index use
 * `IF NOT EXISTS` (the DO block swallows `duplicate_object`), and the
 * backfill only touches rows that are still unlinked.
 */
export class TransactionBudgetCategoryLink1800000000012
  implements MigrationInterface
{
  name = 'TransactionBudgetCategoryLink1800000000012';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(
      `ALTER TABLE "bg_public"."transactions"
         ADD COLUMN IF NOT EXISTS "budgetCategoryId" integer`,
    );

    await qr.query(`
      DO $$
      BEGIN
        ALTER TABLE "bg_public"."transactions"
          ADD CONSTRAINT "FK_transactions_budgetCategoryId"
          FOREIGN KEY ("budgetCategoryId")
          REFERENCES "bg_public"."budget_categories" ("id")
          ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await qr.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transactions_budgetCategoryId"
         ON "bg_public"."transactions" ("budgetCategoryId")`,
    );

    const [before] = await qr.query(`
      SELECT COUNT(*) FILTER (WHERE t."amount" < 0) AS expenses,
             COUNT(*) FILTER (WHERE t."amount" >= 0) AS incomes
        FROM "bg_public"."transactions" AS t
       WHERE t."budgetCategoryId" IS NULL
    `);

    await qr.query(`
      WITH candidates AS (
        SELECT t."id" AS "transactionId",
               COUNT(bc."id") AS "matches",
               MIN(bc."id") AS "budgetCategoryId"
          FROM "bg_public"."transactions" AS t
          JOIN "bg_public"."budgets" AS b
            ON b."userId" = t."userId"
           AND b."type" = 'spending'
           AND t."date" BETWEEN b."startDate" AND b."endDate"
          JOIN "bg_public"."budget_categories" AS bc
            ON bc."budgetId" = b."id"
           AND lower(bc."name") = lower(t."category")
         WHERE t."budgetCategoryId" IS NULL
           AND t."amount" < 0
         GROUP BY t."id"
      )
      UPDATE "bg_public"."transactions" AS t
         SET "budgetCategoryId" = c."budgetCategoryId"
        FROM candidates AS c
       WHERE c."transactionId" = t."id"
         AND c."matches" = 1
    `);

    const [after] = await qr.query(`
      SELECT COUNT(*) FILTER (WHERE "budgetCategoryId" IS NOT NULL) AS linked,
             COUNT(*) FILTER (WHERE "budgetCategoryId" IS NULL) AS unlinked
        FROM "bg_public"."transactions"
    `);

    console.log(
      `[D2.2] transactions: ${before.expenses} expense rows considered ` +
        `(${before.incomes} income rows never linked); ` +
        `${after.linked} linked now, ${after.unlinked} left NULL ` +
        `(ambiguous or no match — legacy fallback keeps them readable).`,
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(
      `DROP INDEX IF EXISTS "bg_public"."IDX_transactions_budgetCategoryId"`,
    );
    await qr.query(
      `ALTER TABLE "bg_public"."transactions"
         DROP CONSTRAINT IF EXISTS "FK_transactions_budgetCategoryId"`,
    );
    await qr.query(
      `ALTER TABLE "bg_public"."transactions"
         DROP COLUMN IF EXISTS "budgetCategoryId"`,
    );
  }
}
