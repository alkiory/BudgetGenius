import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Announcement windows must be absolute instants.
 *
 * `timestamp` (without time zone) stores wall-clock time: the API serialises a
 * JS `Date` in the process time zone, while `now()` runs in the database time
 * zone. When those differ (server in CET, database in UTC) a "publish now"
 * announcement is written one hour in the future and never goes live.
 *
 * `timestamptz` stores the instant, so `publishedAt <= now()` is correct in
 * every deployment. Existing values were wall-clock UTC, hence the
 * `AT TIME ZONE 'UTC'` conversion.
 */
export class AnnouncementTimezones1800000000016 implements MigrationInterface {
  name = 'AnnouncementTimezones1800000000016';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE "bg_public"."app_notifications"
        ALTER COLUMN "publishedAt" TYPE timestamptz USING "publishedAt" AT TIME ZONE 'UTC',
        ALTER COLUMN "expiresAt" TYPE timestamptz USING "expiresAt" AT TIME ZONE 'UTC'
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE "bg_public"."app_notifications"
        ALTER COLUMN "publishedAt" TYPE timestamp USING "publishedAt" AT TIME ZONE 'UTC',
        ALTER COLUMN "expiresAt" TYPE timestamp USING "expiresAt" AT TIME ZONE 'UTC'
    `);
  }
}
