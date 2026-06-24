import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Regression guard beyond Bug 3 (EntityPropertyNotFoundError on
 * `BudgetCategory.user`).
 *
 * `BudgetService.createBudgetCategory` runs an in-memory / DB-read
 * duplicate check (post-fix: `repo.findCategotyQuery({ where: { budget:
 * { id, user: { id } } } })`) before INSERT to validate that the same
 * parent budget does not already have a category with the same name.
 * That check is racy under concurrent POSTs — two clients with the
 * same `(budgetId, name)` can both pass it, then both INSERT, leaving
 * two rows and no signal to the user. The application reconcile would
 * then inflate `totalAllocated`/`totalSpent` and silently drop one row
 * on the next round-trip.
 *
 * The fix is a UNIQUE constraint at the storage layer so the second
 * writer fails atomically with SQLSTATE `23505` (`unique_violation`),
 * and a sibling `try/catch` in the service (see
 * `budget.service.ts.createBudgetCategory`) translates that error into
 * the same `BadRequestException` the app-level check throws for the
 * common race — so the API contract is identical for both paths.
 *
 * The migration is two-step:
 *
 *   1. Dedupe. Concurrent inserts that slipped through between the
 *      initial launch of `createBudgetCategory` and this migration
 *      have left a small number of `(budgetId, name)` collisions in
 *      the table. The deterministic rule is "the row with the lowest
 *      `id` wins; newer duplicates are deleted". Earliest data wins
 *      matches user intent (the original category was theirs; the
 *      later duplicate was almost certainly a typo retry). Deleted
 *      rows are logged via `RAISE NOTICE` so `migration:run` shows
 *      the immediate impact without a follow-up `SELECT count`.
 *
 *   2. Add the constraint. `UQ_budget_categories_budgetId_name`
 *      follows the descriptive-name style of
 *      `CHK_user_settings_currency_supported` (migration 1800000000001).
 *      We use a UNIQUE CONSTRAINT rather than a UNIQUE INDEX because
 *      `\\d bg_public.budget_categories` introspection shows it as a
 *      declarative business rule, which is what readers expect.
 *
 * Idempotency. The ADD CONSTRAINT is wrapped in
 * `DO $$ ... EXCEPTION WHEN duplicate_table OR duplicate_object THEN
 * null; END $$` so a re-run after a successful apply does not crash
 * with 42710 (duplicate_object on the constraint name) or 42P07
 * (duplicate_table on the auto-created backing index). The DELETE in
 * step 1 needs no wrapper because it is a no-op on a clean table.
 *
 * The dedupe is **one-way**: `down()` drops the constraint, but does
 * NOT restore the deleted duplicate rows because Postgres has no
 * audit trail of which rows the dedupe removed. Manual data
 * restoration is required for a fully reverted environment;
 * `migration:revert` of this migration is intended as a recovery
 * path for the schema only.
 *
 * Case-sensitivity. The constraint matches the app-level check
 * exactly: case-sensitive literal equality. Earlier drafts considered
 * `LOWER(name)` but that would create an asymmetry with the in-app
 * check. Same trade-off is shipped for the duplicate-name UX in both
 * paths.
 */
export class BudgetCategoryUniqueName1800000000003
  implements MigrationInterface
{
  name = 'BudgetCategoryUniqueName1800000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Dedupe. Keep the row with the lowest id per (budgetId, name).
    //    `GET DIAGNOSTICS affected_count = ROW_COUNT` is the idiomatic
    //    pattern for counting deletions in a `DO` block (a CTE-with-
    //    RETURNING + `SELECT INTO` is also valid but more verbose for
    //    this single-statement case).
    await queryRunner.query(`
      DO $$
      DECLARE affected_count integer;
      BEGIN
        DELETE FROM "bg_public"."budget_categories"
          WHERE id NOT IN (
            SELECT MIN(id) FROM "bg_public"."budget_categories"
            GROUP BY "budgetId", "name"
          );
        GET DIAGNOSTICS affected_count = ROW_COUNT;
        RAISE NOTICE 'BudgetCategoryUniqueName1800000000003: deleted % duplicate (budgetId, name) row(s) during dedupe', affected_count;
      END $$;
    `);

    // 2. Add the UNIQUE constraint. The realistic re-run path is
    //    `duplicate_object` (42710) on the named constraint — this
    //    fires whenever the constraint already exists. `duplicate_table`
    //    (42P07) is included as a defensive belt for the edge case
    //    where a sibling migration (or out-of-band DDL) creates a
    //    separate index that happens to collide with the backing
    //    index Postgres auto-creates for this UNIQUE constraint.
    //    Swallowing both keeps the migration safely re-runnable.
    //
    //    IMPORTANT: the constraint name literal must match
    //    `BUDGET_CATEGORY_UNIQUE_CONSTRAINT_NAME` exported from
    //    `apps/api/src/domain/dashboard/budget-category.entity.ts`.
    //    That constant is the runtime-side authority used by
    //    `BudgetService.createBudgetCategory` to identify the race
    //    path. Migrations load by file path so we cannot import the
    //    constant directly \u2014 they must be kept in lockstep manually.
    await queryRunner.query(
      `DO $$ BEGIN
         ALTER TABLE "bg_public"."budget_categories"
           ADD CONSTRAINT "UQ_budget_categories_budgetId_name"
           UNIQUE ("budgetId", "name");
       EXCEPTION
         WHEN duplicate_table OR duplicate_object THEN null;
       END $$`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bg_public"."budget_categories"
        DROP CONSTRAINT IF EXISTS "UQ_budget_categories_budgetId_name"`,
    );
    // The dedupe data rewrite is NOT reversed here — see file header.
  }
}
