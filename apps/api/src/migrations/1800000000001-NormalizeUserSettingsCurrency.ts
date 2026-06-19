import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MVP currency prune (T3.x): the frontend `Currency` type narrows to
 * `"USD" | "EUR" | "COP"`. Pre-existing user_settings rows whose
 * `currency` was set to a now-unsupported code (GBP, JPY, AUD, CAD)
 * would still load through the API fine — but the
 * `currencyService.formatCurrency` rate lookup in the frontend would
 * then multiply by `undefined` (the upstream provider's rate for those
 * codes can also come back as `NaN`), producing the "NaN" the user
 * reported for AUD/CAD and historically for JPY/GBP.
 *
 * `up()` does two things in one migration:
 *   1. Rewrites every legacy row to `'USD'` so the next deploy ships a
 *      clean dashboard for every existing account.
 *   2. Adds a CHECK constraint so future inserts (via TypeORM or raw
 *      DML) cannot reintroduce a legacy code. Without this any
 *      out-of-band write (`UPDATE user_settings SET currency='GBP' …`,
 *      an admin tooling mistake, a forgotten message-bus consumer…)
 *      would silently bring the NaN rendering back.
 * `down()` removes the constraint; the data rewrite is documented as
 * a one-way fix because the source-of-truth mapping per row is lost.
 */
export class NormalizeUserSettingsCurrency1800000000001
  implements MigrationInterface
{
  name = 'NormalizeUserSettingsCurrency1800000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Rewrite legacy currency values to a supported one.
    await queryRunner.query(
      `UPDATE "bg_public"."user_settings"
       SET "currency" = 'USD'
       WHERE "currency" IN ('GBP', 'JPY', 'AUD', 'CAD')`,
    );

    // 2. Lock the column to the supported subset via CHECK. TypeORM also
    //    narrows the webClient `Currency` union to the same three codes,
    //    so the contract now matches end-to-end.
    await queryRunner.query(
      `ALTER TABLE "bg_public"."user_settings"
        ADD CONSTRAINT "CHK_user_settings_currency_supported"
        CHECK ("currency" IN ('USD', 'EUR', 'COP'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bg_public"."user_settings"
        DROP CONSTRAINT IF EXISTS "CHK_user_settings_currency_supported"`,
    );
    // The data rewrite (USD-ing the legacy rows) is NOT reversed here —
    // we no longer know which code each row used to hold, and silently
    // picking a default would corrupt the audit history. Re-enable the
    // dropped currencies by removing the constraint above and running a
    // manual data restoration script under controlled ops.
  }
}
