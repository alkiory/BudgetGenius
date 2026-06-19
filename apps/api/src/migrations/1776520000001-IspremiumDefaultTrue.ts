import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MVP free-product launch: `users.isPremium` becomes dormant.
 * New column default is `true` so any freshly-created user is treated as premium
 * (the field is kept for backward compatibility of API responses).
 * Existing rows are normalized to `true`.
 */
export class IspremiumDefaultTrue1776520000001 implements MigrationInterface {
  name = 'IspremiumDefaultTrue1776520000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bg_public"."users" ALTER COLUMN "isPremium" SET DEFAULT true`,
    );
    await queryRunner.query(
      `UPDATE "bg_public"."users" SET "isPremium" = true WHERE "isPremium" = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: does not restore false on existing rows; the default removal is the
    // reversible half. Manual data fix required for a fully-restored environment.
    await queryRunner.query(
      `ALTER TABLE "bg_public"."users" ALTER COLUMN "isPremium" DROP DEFAULT`,
    );
  }
}
