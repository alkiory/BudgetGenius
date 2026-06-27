import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds the `currency` column to `budget_categories`, backfills existing rows
 * from the parent user's `user_settings.currency` (defaulting to 'USD' for
 * orphan rows / cold-start users with no settings row), and locks the column
 * down as `NOT NULL` with a 'USD' DEFAULT for future inserts.
 *
 * Why a single atomic migration (T3.1 + T3.2 collapsed):
 *   The audit's open-question 2 explicitly preferred "accept the user's
 *   current currency" backfill — that requires reading from
 *   `user_settings` and writing to `budget_categories` in the same
 *   transaction so a partial apply can't leave rows with NULL `currency`
 *   when the entity layer starts enforcing NOT NULL. Splitting T3.1 /
 *   T3.2 would either need a permanent nullable column (sacrificing the
 *   strict-schema invariant the rest of the codebase encodes) OR a
 *   multi-deploy dance that's noisier than one idempotent migration.
 *
 * Idempotency:
 *   Every statement uses `IF NOT EXISTS` / `IF EXISTS` so a partially-
 *   applied migration that was interrupted at the ALTER step can be
 *   re-run safely. The down migration drops the column outright;
 *   pre-existing rows that were backfilled lose their currency tag.
 *
 * Reversibility:
 *   The down() drops the column. The data deleted by the up() backfill
 *   is not restored — same caveat as the prior BudgetCategoryUniqueName
 *   migration. We do not attempt to recreate the per-row currency
 *   because no audit trail exists for the original (NULL) state.
 */
export class AddCurrencyToBudgetCategory1800000000004
  implements MigrationInterface
{
  public async up(qr: QueryRunner): Promise<void> {
    // 1. ADD COLUMN nullable (so the backfill UPDATE can run without
    //    violating NOT NULL during the transition).
    await qr.query(/* sql */ `
      ALTER TABLE "bg_public"."budget_categories"
        ADD COLUMN IF NOT EXISTS "currency" "bg_public"."currency_enum" NULL;
    `);

    // 2. Backfill: join budget_categories -> budgets -> user_settings
    //    and copy the user's preferred currency. DEFAULT 'USD' covers
    //    orphan rows where the parent user has no user_settings row (e.g.
    //    deleted / cold-start), matching the entity's runtime default
    //    and the rest of the codebase's "treat absence as USD" contract.
    await qr.query(/* sql */ `
      UPDATE "bg_public"."budget_categories" AS bc
      SET "currency" = COALESCE(
        us."currency",
        'USD'::"bg_public"."currency_enum"
      )
      FROM "bg_public"."budgets" AS b
        LEFT JOIN "bg_public"."user_settings" AS us
          ON us."userId" = b."userId"
      WHERE bc."budgetId" = b."id"
        AND bc."currency" IS NULL;
    `);

    // 3. Lock down: NOT NULL + DEFAULT 'USD' for future inserts that
    //    bypass the entity layer (raw SQL, psql console, etc.).
    await qr.query(/* sql */ `
      ALTER TABLE "bg_public"."budget_categories"
        ALTER COLUMN "currency" SET NOT NULL;
    `);

    await qr.query(/* sql */ `
      ALTER TABLE "bg_public"."budget_categories"
        ALTER COLUMN "currency" SET DEFAULT 'USD';
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(/* sql */ `
      ALTER TABLE "bg_public"."budget_categories"
        DROP COLUMN IF EXISTS "currency";
    `);
  }
}
