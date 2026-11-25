import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Provider credentials for Finny, managed from the backoffice.
 *
 * Values are sealed by the API before insert (`secret-box`), so the column is
 * plain `text` and only the superadmin endpoints decrypt it.
 */
export class AppProviderKeys1800000000017 implements MigrationInterface {
  name = 'AppProviderKeys1800000000017';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "bg_public"."app_provider_keys" (
        "id" serial PRIMARY KEY,
        "label" character varying(80) NOT NULL,
        "provider" character varying(32) NOT NULL DEFAULT 'openai',
        "encryptedKey" text NOT NULL,
        "lastFour" character varying(4) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "priority" integer NOT NULL DEFAULT 0,
        "lastUsedAt" timestamptz,
        "lastFailedAt" timestamptz,
        "lastError" character varying(240),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await qr.query(
      `CREATE INDEX IF NOT EXISTS "IDX_app_provider_keys_active" ON "bg_public"."app_provider_keys" ("isActive", "priority")`,
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "bg_public"."app_provider_keys"`);
  }
}
