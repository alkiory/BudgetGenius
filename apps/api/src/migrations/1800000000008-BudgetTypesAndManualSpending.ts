import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Budgets v2: spending vs savings semantics + manual spending baseline.
 *
 * - `budgets.type` classifies the whole budget. Every pre-existing row was
 *   an expense cap, so it gets the `spending` default and keeps behaving
 *   exactly as before.
 * - `budget_categories.manualSpent` stores the portion the user entered by
 *   hand ("Añadir gasto" / "Añadir ahorro"). The legacy `spent` column is
 *   kept as the cached effective total (`manualSpent + expenses from
 *   transactions`). Existing `spent` values are copied into `manualSpent`
 *   so no manually tracked amount is lost.
 *
 * The column-existence guards make `up()` safe to re-run: the copy runs
 * only when `manualSpent` is first created.
 */
export class BudgetTypesAndManualSpending1800000000008
  implements MigrationInterface
{
  name = 'BudgetTypesAndManualSpending1800000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const budgetType = await queryRunner.query(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'bg_public'
          AND table_name = 'budgets'
          AND column_name = 'type'`,
    );
    if (budgetType.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "bg_public"."budgets"
           ADD COLUMN "type" character varying(16) NOT NULL DEFAULT 'spending'`,
      );
    }

    const manualSpent = await queryRunner.query(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'bg_public'
          AND table_name = 'budget_categories'
          AND column_name = 'manualSpent'`,
    );
    if (manualSpent.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "bg_public"."budget_categories"
           ADD COLUMN "manualSpent" numeric NOT NULL DEFAULT 0`,
      );
      // Preserve every amount users had entered manually before the split.
      await queryRunner.query(
        `UPDATE "bg_public"."budget_categories"
            SET "manualSpent" = "spent"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bg_public"."budget_categories"
         DROP COLUMN IF EXISTS "manualSpent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bg_public"."budgets"
         DROP COLUMN IF EXISTS "type"`,
    );
  }
}
