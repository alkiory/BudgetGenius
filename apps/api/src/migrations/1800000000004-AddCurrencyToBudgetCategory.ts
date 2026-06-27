import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurrencyToBudgetCategory1800000000004
  implements MigrationInterface {
  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(/* sql */ `
      ALTER TABLE "bg_public"."budget_categories"
        ADD COLUMN IF NOT EXISTS "currency" "bg_public"."currency_enum" NULL;
    `);

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
