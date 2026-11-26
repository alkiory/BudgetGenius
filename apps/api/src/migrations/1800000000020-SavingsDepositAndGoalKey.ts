import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 1. Persists `isSavingsDeposit` on `transactions` so deleting a savings goal
 *    or category (`ON DELETE SET NULL` on `budgetCategoryId`) never turns
 *    historical savings deposits into ordinary expenses in reports/overview.
 * 2. Adds `goalKey` on `budgets` so system-recognized goals such as
 *    `emergency-fund` stay linked even if the user renames the budget and
 *    category.
 */
export class SavingsDepositAndGoalKey1800000000020
  implements MigrationInterface
{
  name = 'SavingsDepositAndGoalKey1800000000020';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(
      `ALTER TABLE "bg_public"."transactions"
         ADD COLUMN IF NOT EXISTS "isSavingsDeposit" boolean NOT NULL DEFAULT false`,
    );

    await qr.query(
      `UPDATE "bg_public"."transactions" tx
         SET "isSavingsDeposit" = true
       FROM "bg_public"."budget_categories" bc
       INNER JOIN "bg_public"."budgets" b ON b.id = bc."budgetId"
       WHERE tx."budgetCategoryId" = bc.id
         AND b.type = 'savings'`,
    );

    await qr.query(
      `ALTER TABLE "bg_public"."budgets"
         ADD COLUMN IF NOT EXISTS "goalKey" varchar(64)`,
    );

    await qr.query(
      `UPDATE "bg_public"."budgets" b
         SET "goalKey" = 'emergency-fund'
       WHERE b.type = 'savings'
         AND b."goalKey" IS NULL
         AND (
           b.name = 'Fondo de emergencia'
           OR EXISTS (
             SELECT 1
             FROM "bg_public"."budget_categories" bc
             WHERE bc."budgetId" = b.id
               AND bc.name = 'Fondo de emergencia'
           )
         )`,
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(
      `ALTER TABLE "bg_public"."budgets"
         DROP COLUMN IF EXISTS "goalKey"`,
    );
    await qr.query(
      `ALTER TABLE "bg_public"."transactions"
         DROP COLUMN IF EXISTS "isSavingsDeposit"`,
    );
  }
}

