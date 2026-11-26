import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a catalogue entry belong to a module.
 *
 * The backoffice registers a module (`cards`, `banks`) and its components
 * (`card-type`, `bank-type`); the app's Modules page groups them by this key.
 * Nullable on purpose: modules and integrations that do not belong to another
 * entry keep working unchanged, and existing rows need no backfill.
 */
export class AppModuleParentKey1800000000018 implements MigrationInterface {
  name = 'AppModuleParentKey1800000000018';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(
      `ALTER TABLE "bg_public"."app_modules"
         ADD COLUMN IF NOT EXISTS "parentKey" character varying(80)`,
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(
      `ALTER TABLE "bg_public"."app_modules"
         DROP COLUMN IF EXISTS "parentKey"`,
    );
  }
}
