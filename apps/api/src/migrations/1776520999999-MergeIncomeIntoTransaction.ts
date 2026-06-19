import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Merge the legacy `bg_public.incomes` table into `bg_public.transactions`.
 *
 * Phase 2 of the Income-domain redundancy plan
 * (`rpi/income-redundancy/plan.md`). The Income backend stack is being
 * collapsed into the Transaction backend stack — Income.amount becomes
 * Transaction.amount (always positive; the income DTO enforces > 0 today),
 * Income.recurrence moves onto the newly added `transactions.recurrence`
 * column (nullable; declared in Phase 1), and every other column flows
 * through verbatim. The `incomes_snapshot_2026` table is retained so a
 * future `migration:revert` can rebuild the legacy table from a known-good
 * copy without losing user data.
 *
 * Idempotency notes:
 *  - The `ADD COLUMN … IF NOT EXISTS` is safe across re-runs in case
 *    TypeORM-synchronize or a manual schema fix has already added the
 *    column.
 *  - The snapshot step is intentionally NOT `IF NOT EXISTS`-guarded: once
 *    the `incomes` table is dropped, the snapshot is the only source of
 *    truth. Production should only run this migration once.
 *  - Re-running `up()` after `down()` would re-INSERT the migrated rows
 *    (different auto-generated ids, identical content). That is acceptable
 *    for a one-shot production migration; the spec asserts the up+down
 *    round-trip cleanly.
 */
export class MergeIncomeIntoTransaction1776520999999
  implements MigrationInterface
{
  name = 'MergeIncomeIntoTransaction1776520999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 0. Idempotency guard for CI/dev re-runs: if a previous run (or the
    //    spec's afterEach) left a stale snapshot, drop it before
    //    re-creating. The snapshot is a one-shot rollback anchor; we
    //    rebuild it deterministically every time up() runs.
    await queryRunner.query(
      `DROP TABLE IF EXISTS "bg_public"."incomes_snapshot_2026"`,
    );

    // 1. Ensure `recurrence` exists on transactions. Phase 1 declares it
    //    on the Entity; this ALTER guards against any environment that
    //    ran entity sync before this migration applied.
    await queryRunner.query(
      `ALTER TABLE "bg_public"."transactions" ADD COLUMN IF NOT EXISTS "recurrence" character varying`,
    );

    // 2. Snapshot the legacy incomes rows for rollback. Retained past the
    //    migration so future `migration:revert` calls can rebuild income.
    await queryRunner.query(
      `CREATE TABLE "bg_public"."incomes_snapshot_2026" AS TABLE "bg_public"."incomes"`,
    );

    // 3. Insert-SELECT each legacy income row into transactions.
    //    `ABS(amount)` is a defensive belt-and-braces guard: the income
    //    DTO enforces amount > 0 at the API layer, but a direct INSERT
    //    against the legacy table could have produced a negative row.
    await queryRunner.query(
      `INSERT INTO "bg_public"."transactions"
         ("date","description","amount","category","recurrence","createdAt","updatedAt","userId")
       SELECT
         "date",
         "description",
         ABS("amount") AS "amount",
         "category",
         "recurrence",
         "createdAt",
         "updatedAt",
         "userId"
       FROM "bg_public"."incomes"`,
    );

    // 4. Drop the FK from incomes to users (the PK constraint cascades
    //    automatically when we drop the table in step 5, but we drop the
    //    FK first so a future rollback (which restores the table) can
    //    re-add the FK exactly as the InitialMigration defined it).
    await queryRunner.query(
      `ALTER TABLE "bg_public"."incomes" DROP CONSTRAINT IF EXISTS "FK_f6b7c6bbe04a203dfc67ae627ab"`,
    );

    // 5. Drop the legacy table.
    await queryRunner.query(`DROP TABLE "bg_public"."incomes"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Rebuild `incomes` from the snapshot, preserving PK + the original
    //    column types (LIKE … INCLUDING ALL copies indexes and the PK
    //    but NOT foreign keys; we re-add the FK explicitly below).
    await queryRunner.query(
      `CREATE TABLE "bg_public"."incomes" (LIKE "bg_public"."incomes_snapshot_2026" INCLUDING ALL)`,
    );

    // 2. Re-add the FK constraint exactly as InitialMigration defines it.
    await queryRunner.query(
      `ALTER TABLE "bg_public"."incomes" ADD CONSTRAINT "FK_f6b7c6bbe04a203dfc67ae627ab" FOREIGN KEY ("userId") REFERENCES "bg_public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // 3. Restore the row data from the snapshot. The CREATE TABLE in
    //    step 1 only copies schema — without this INSERT the rebuilt
    //    table would be empty and any unrun Phase-3/4 income endpoints
    //    would see 0 rows.
    await queryRunner.query(
      `INSERT INTO "bg_public"."incomes"
         ("id","date","description","amount","category","recurrence","createdAt","updatedAt","userId")
       SELECT
         "id","date","description","amount","category","recurrence","createdAt","updatedAt","userId"
       FROM "bg_public"."incomes_snapshot_2026"`,
    );

    // 4. Reset the incomes id sequence so future INSERTs don't collide
    //    with restored ids (relevant if the legacy application server
    //    continues running after migration:revert).
    await queryRunner.query(
      `SELECT setval(
         pg_get_serial_sequence('"bg_public"."incomes"', 'id'),
         GREATEST(COALESCE((SELECT MAX(id) FROM "bg_public"."incomes"), 0), 1)
       )`,
    );

    // 5. We deliberately KEEP `incomes_snapshot_2026` past the down —
    //    a future up() can re-pull from it. (See plan §Risk Mitigation.)
  }
}
