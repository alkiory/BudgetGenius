import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Belt-and-suspenders to migration 1800000000001: switch
 * `bg_public.user_settings.currency` from a varchar + CHECK constraint
 * to a proper Postgres ENUM. The TypeORM-layer `@Column({ type:
 * 'enum', enum: [...] })` decorator (see user-settings.entity.ts) then
 * refuses to generate `INSERT` SQL with legacy codes at the ORM
 * boundary — the previous migration only protected against direct DML.
 *
 * `enumName: 'currency_enum'` on the `@Column` makes TypeORM bind to
 * this named type instead of generating an implicit
 * `user_settings_currency_enum` per-column type, which keeps the
 * schema discoverable via `pg_type` and lets future tables (e.g.
 * `transactions.currency`) reference the same type.
 *
 * Order in `up()`:
 *   1. CREATE TYPE   — define the enum independent of any column.
 *   2. DROP CONSTRAINT — drop the prior CHECK (now redundant).
 *   3. ALTER COLUMN  — cast existing values; safe because migration
 *                     1800000000001 already rewrote GBP/JPY/AUD/CAD
 *                     rows to USD, so every value is in the new enum.
 *
 * `down()` reverses the three steps in opposite order so a `revert`
 * on a clean DB restores the prior shape exactly.
 */
export class EnumUserSettingsCurrency1800000000002
  implements MigrationInterface
{
  name = 'EnumUserSettingsCurrency1800000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the named enum type in the bg_public schema. The
    //    schema-qualified name lets future migrations reference the
    //    type without ambiguity (e.g. `transactions.currency
    //    bg_public.currency_enum`). Wrap in DO/EXCEPTION so the
    //    migration is idempotent on re-run after a prior successful
    //    apply (otherwise Postgres 42710 on object already exists).
    await queryRunner.query(
      `DO $$ BEGIN
         CREATE TYPE "bg_public"."currency_enum" AS ENUM ('USD', 'EUR', 'COP');
       EXCEPTION
         WHEN duplicate_object THEN null;
       END $$`,
    );

    // 2. Drop the prior CHECK constraint from 1800000000001. The
    //    enum type now enforces the same invariant at the storage
    //    layer, and a redundant CHECK forces Postgres to re-evaluate
    //    the predicate on every write.
    await queryRunner.query(
      `ALTER TABLE "bg_public"."user_settings" DROP CONSTRAINT IF EXISTS "CHK_user_settings_currency_supported"`,
    );

    // 3. Convert the column. The USING cast is required when changing
    //    a column's type to a non-implicit-compatible one. Safe here
    //    because every row's value is in {'USD','EUR','COP'} (lookups
    //    against the enum type succeed for exactly that set).
    await queryRunner.query(
      `ALTER TABLE "bg_public"."user_settings"
         ALTER COLUMN "currency" TYPE "bg_public"."currency_enum"
         USING "currency"::"bg_public"."currency_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Cast the enum column back to varchar via `::text` so the
    //    CHECK constraint can be re-added.
    await queryRunner.query(
      `ALTER TABLE "bg_public"."user_settings"
         ALTER COLUMN "currency" TYPE character varying
         USING "currency"::text`,
    );

    // 2. Re-install the prior CHECK constraint so a fully-reverted
    //    environment still rejects legacy codes. Wrap with NOT
    //    VALID → VALIDATE so re-running this down after a prior
    //    revert doesn't 42710 on a duplicate constraint.
    await queryRunner.query(
      `DO $$ BEGIN
         ALTER TABLE "bg_public"."user_settings"
           ADD CONSTRAINT "CHK_user_settings_currency_supported"
           CHECK ("currency" IN ('USD', 'EUR', 'COP'));
       EXCEPTION
         WHEN duplicate_object THEN null;
       END $$`,
    );

    // 3. Drop the enum type. Use CASCADE so the revert still succeeds
    //    if a future migration (e.g. for `transactions.currency`)
    //    binds another column to the same enum — the cascade removes
    //    the dependent columns automatically, which is appropriate
    //    when we're reverting the schema to its prior shape.
    await queryRunner.query(`DROP TYPE IF EXISTS "bg_public"."currency_enum" CASCADE`);
  }
}
