import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backoffice storage for the super admin surface.
 *
 * Three app-level tables, none of them tied to a user row:
 *
 * - `app_modules`       — inventory of product modules with status/version.
 * - `app_api_keys`      — hashed machine credentials (plaintext never stored).
 * - `app_notifications` — announcements with publish/expiry windows.
 *
 * The `superadmin` role itself is just a new value in `users.role`, which is a
 * free-form varchar: no enum migration is needed.
 */
export class SuperadminBackoffice1800000000015 implements MigrationInterface {
  name = 'SuperadminBackoffice1800000000015';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "bg_public"."app_modules" (
        "id" serial PRIMARY KEY,
        "key" character varying(80) NOT NULL,
        "name" character varying(120) NOT NULL,
        "description" text,
        "kind" character varying(16) NOT NULL DEFAULT 'module',
        "category" character varying(40) NOT NULL DEFAULT 'core',
        "status" character varying(16) NOT NULL DEFAULT 'active',
        "version" character varying(20) NOT NULL DEFAULT '1.0.0',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "isCore" boolean NOT NULL DEFAULT false,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_app_modules_key" UNIQUE ("key")
      )
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS "bg_public"."app_api_keys" (
        "id" serial PRIMARY KEY,
        "name" character varying(100) NOT NULL,
        "prefix" character varying(24) NOT NULL,
        "hashedKey" character varying(64) NOT NULL,
        "scopes" text,
        "lastUsedAt" timestamp,
        "revokedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS "bg_public"."app_notifications" (
        "id" serial PRIMARY KEY,
        "title" character varying(140) NOT NULL,
        "body" text NOT NULL,
        "level" character varying(16) NOT NULL DEFAULT 'info',
        "audience" character varying(16) NOT NULL DEFAULT 'all',
        "published" boolean NOT NULL DEFAULT false,
        "publishedAt" timestamp,
        "expiresAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    // The backoffice filters keys by revocation and notifications by publish
    // state; both lists paginate by creation time.
    await qr.query(
      `CREATE INDEX IF NOT EXISTS "IDX_app_api_keys_revokedAt" ON "bg_public"."app_api_keys" ("revokedAt")`,
    );
    await qr.query(
      `CREATE INDEX IF NOT EXISTS "IDX_app_notifications_published" ON "bg_public"."app_notifications" ("published", "publishedAt")`,
    );
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "bg_public"."app_notifications"`);
    await qr.query(`DROP TABLE IF EXISTS "bg_public"."app_api_keys"`);
    await qr.query(`DROP TABLE IF EXISTS "bg_public"."app_modules"`);
  }
}
