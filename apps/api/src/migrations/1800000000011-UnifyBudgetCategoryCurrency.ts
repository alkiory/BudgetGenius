import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * D1 (Wave 1) — one currency per account.
 *
 * `budget_categories.currency` (added in `1800000000004`) was a per-row copy
 * of `user_settings.currency` that no reader ever consulted: every money
 * surface formats with the profile currency, and `transactions`/`budgets`
 * never had a currency column at all. Keeping the copy meant a row could
 * disagree with its owner (dev had 2 such rows) and any future consumer that
 * trusted the column would inherit that lie.
 *
 * The whole forward migration is one `DROP COLUMN IF EXISTS`:
 *
 * - Postgres drops the column's DEFAULT along with the column, so the
 *   legacy `'USD'` default needs no separate statement.
 * - TypeORM runs a migration inside one transaction, so no reader can
 *   observe a backfilled value before the drop: aligning the copies first
 *   would write rows nobody is able to read.
 * - `IF EXISTS` is what makes a re-run (or a DB where the DDL was applied
 *   manually) a no-op instead of a hard failure.
 *
 * `down()` restores the column from `user_settings`, so the revert is
 * lossless: unlike the lossy rewrite in `1800000000001`, the value is
 * derivable from the owner's profile.
 */
export class UnifyBudgetCategoryCurrency1800000000011
  implements MigrationInterface
{
  name = 'UnifyBudgetCategoryCurrency1800000000011';

  public async up(qr: QueryRunner): Promise<void> {
    // No CASCADE on purpose: if someone attached a view or constraint to the
    // column out of band, the migration should fail loudly, not delete it.
    await qr.query(
      `ALTER TABLE "bg_public"."budget_categories"
         DROP COLUMN IF EXISTS "currency"`,
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(
      `ALTER TABLE "bg_public"."budget_categories"
         ADD COLUMN IF NOT EXISTS "currency" "bg_public"."currency_enum"`,
    );

    // A scalar subquery instead of `UPDATE ... FROM budgets ... JOIN
    // user_settings`: `budgetId` is nullable in the initial schema (it never
    // received a NOT NULL), so an orphan category would keep NULL and the
    // `SET NOT NULL` below would abort the revert halfway. COALESCE gives
    // that edge case the same 'USD' fallback the original column had.
    await qr.query(`
      UPDATE "bg_public"."budget_categories" AS bc
         SET "currency" = COALESCE(
           (SELECT us."currency"
              FROM "bg_public"."budgets" AS b
              JOIN "bg_public"."user_settings" AS us
                ON us."userId" = b."userId"
             WHERE b."id" = bc."budgetId"),
           'USD'::"bg_public"."currency_enum"
         )
       WHERE bc."currency" IS NULL
    `);

    await qr.query(
      `ALTER TABLE "bg_public"."budget_categories"
         ALTER COLUMN "currency" SET NOT NULL`,
    );

    await qr.query(
      `ALTER TABLE "bg_public"."budget_categories"
         ALTER COLUMN "currency" SET DEFAULT 'USD'`,
    );
  }
}
