import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The sync revision filters announcements by the shared "live" window and
 * takes `MAX(updatedAt)` over those rows, so this is the index that keeps the
 * 15 s poll from scanning the table.
 *
 * `IDX_app_notifications_active` is the partial form of the same predicate
 * (`published` is the cheap gate; the window columns are what the planner
 * needs next).
 */
export class AnnouncementLiveIndex1800000000021 implements MigrationInterface {
  name = 'AnnouncementLiveIndex1800000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_app_notifications_updatedAt" ON "bg_public"."app_notifications" ("updatedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_app_notifications_active" ON "bg_public"."app_notifications" ("publishedAt", "expiresAt") WHERE "published" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "bg_public"."IDX_app_notifications_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "bg_public"."IDX_app_notifications_updatedAt"`,
    );
  }
}
