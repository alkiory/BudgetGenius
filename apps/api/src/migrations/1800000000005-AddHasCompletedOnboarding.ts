import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: add `hasCompletedOnboarding` flag to `bg_public.user_settings`.
 *
 * Android APK audit, 2026-06: the first-time onboarding flow needs a
 * backend-persisted signal that survives across devices and sessions.
 * The flag is `FALSE` by default for all existing rows, which means
 * legacy users see the onboarding once on next login — intentional,
 * because the saved defaults (UTC / USD / en-US) don't reflect their
 * real locale until they confirm. New signups land on this column in
 * the same shape (`FALSE`) until they complete the wizard.
 */
export class AddHasCompletedOnboarding1800000000005
  implements MigrationInterface
{
  name = 'AddHasCompletedOnboarding1800000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bg_public"."user_settings" ` +
        `ADD COLUMN "hasCompletedOnboarding" boolean NOT NULL DEFAULT FALSE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bg_public"."user_settings" ` +
        `DROP COLUMN "hasCompletedOnboarding"`,
    );
  }
}
