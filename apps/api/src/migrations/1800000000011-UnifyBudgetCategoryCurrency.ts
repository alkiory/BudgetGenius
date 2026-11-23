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
 * `up()` aligns the stale copies first (so a reader between steps sees
 * coherent data), then drops the default and the column. After this,
 * `user_settings.currency` is the single source of truth and `SUM(amount)`
 * is valid for every aggregate because all stored amounts share one unit.
 *
 * Idempotent by design: the column-existence guard makes a re-run (or a DB
 * where the SQL was applied manually) a no-op instead of a hard failure.
 */
export class UnifyBudgetCategoryCurrency1800000000011
  implements MigrationInterface
{
  name = 'UnifyBudgetCategoryCurrency1800000000011';

  public async up(qr: QueryRunner): Promise<void> {
    const [{ exists }] = (await qr.query(
      `SELECT EXISTS (
         SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'bg_public'
            AND table_name = 'budget_categories'
            AND column_name = 'currency'
       ) AS exists`,
    )) as Array<{ exists: boolean }>;
    if (!exists) return;

    // 1. Align every category with the currency of the account that owns it.
    //    Categories whose owner has no user_settings row are left as-is: the
    //    column is dropped in step 3, so no value survives to be wrong.
    await qr.query(`
      UPDATE "bg_public"."budget_categories" AS bc
         SET "currency" = us."currency"
        FROM "bg_public"."budgets" AS b
        JOIN "bg_public"."user_settings" AS us
          ON us."userId" = b."userId"
       WHERE bc."budgetId" = b."id"
         AND bc."currency" <> us."currency"
    `);

    // 2. Drop the legacy 'USD' default: there is nothing left to default.
    await qr.query(
      `ALTER TABLE "bg_public"."budget_categories"
         ALTER COLUMN "currency" DROP DEFAULT`,
    );

    // 3. Drop the column itself.
    await qr.query(
      `ALTER TABLE "bg_public"."budget_categories" DROP COLUMN "currency"`,
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    // The value is derivable from the owner's profile, so restoring it is
    // honest — unlike the lossy data rewrite in 1800000000001.
    await qr.query(
      `ALTER TABLE "bg_public"."budget_categories"
         ADD COLUMN IF NOT EXISTS "currency" "bg_public"."currency_enum"`,
    );

    await qr.query(`
      UPDATE "bg_public"."budget_categories" AS bc
         SET "currency" = COALESCE(
           us."currency",
           'USD'::"bg_public"."currency_enum"
         )
        FROM "bg_public"."budgets" AS b
        LEFT JOIN "bg_public"."user_settings" AS us
          ON us."userId" = b."userId"
       WHERE bc."budgetId" = b."id"
         AND bc."currency" IS NULL
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
