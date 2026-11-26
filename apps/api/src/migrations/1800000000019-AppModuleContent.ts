import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets the backoffice author what a catalogue page says.
 *
 * `content` holds the ordered sections (heading, text, attached components) of
 * a page, module or tab. It is nullable on purpose: every entry registered
 * before this column existed keeps rendering from its description and
 * children, with no backfill needed.
 */
export class AppModuleContent1800000000019 implements MigrationInterface {
  name = 'AppModuleContent1800000000019';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(
      `ALTER TABLE "bg_public"."app_modules"
         ADD COLUMN IF NOT EXISTS "content" jsonb`,
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(
      `ALTER TABLE "bg_public"."app_modules"
         DROP COLUMN IF EXISTS "content"`,
    );
  }
}
