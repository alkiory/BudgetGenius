import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: backfill `hasCompletedOnboarding = TRUE` for every row
 * that already existed in `bg_public.user_settings` before the
 * 1800000000005 migration shipped the column.
 *
 * Android APK audit, 2026-06 (correction round):
 *
 *   Migration 1800000000005 added the column with
 *   `NOT NULL DEFAULT FALSE`, which means EVERY row that existed at
 *   apply-time — including the demo user in dev and every existing
 *   user in staging — defaulted to `hasCompletedOnboarding = FALSE`.
 *   Combined with the strict redirect in `protected-route.tsx` and
 *   `splash.tsx`, this trapped every legacy user in the onboarding
 *   wizard on next login, which is incorrect: those users were
 *   already onboarded via their saved preferences in the same row.
 *
 *   We can't decide per-user in pure SQL whether each one "really"
 *   finished onboarding (no audit trail exists), so the safe
 *   assumption is: pre-existing rows count as onboarded. That's the
 *   same UX they had before 1800000000005 shipped — they were never
 *   shown this wizard. Only newly-created users (inserts that
 *   happen on or after the column's creation via the typeorm
 *   `NOT NULL DEFAULT FALSE`) will start their row at FALSE,
 *   which is the only correct signal for the wizard.
 *
 *   The fix is a single `UPDATE` that flips every existing row's
 *   flag. Safe in dev (no real users yet) and safe in pre-prod
 *   (the migration hasn't reached production). Once production
 *   rows start to exist with `FALSE`, a follow-up should snapshot
 *   the deployed column-add timestamp and replace the
 *   unconditional `WHERE` with a `WHERE "createdAt" < :marker`
 *   predicate.
 *
 * No schema change here — only data. Reversible via a no-op `down`
 * since rolling back this data fix would re-trap legacy users,
 * which is worse than the over-eager wizard risk the `=== false`
 * strict check in `protected-route.tsx` already mitigates.
 */
export class MarkExistingUsersOnboardingComplete1800000000006
  implements MigrationInterface
{
  name = 'MarkExistingUsersOnboardingComplete1800000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Flip every pre-existing row. A NULL would be impossible
    // (NOT NULL column) but we keep the explicit `IS NULL` predicate
    // as belt-and-braces so a future schema change that loosens the
    // NOT NULL doesn't silently leave NULL rows treating as
    // "unfinished" via the strict `=== false` check.
    await queryRunner.query(
      `UPDATE "bg_public"."user_settings" ` +
        `SET "hasCompletedOnboarding" = TRUE ` +
        `WHERE "hasCompletedOnboarding" IS FALSE ` +
        `   OR "hasCompletedOnboarding" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reversing would re-trap legacy users, so we intentionally
    // do NOT restore FALSE here. Documented in the JSDoc above.
    // Kept as a no-op so the migration remains reversible in the
    // typeorm sense (rolling back succeeds without erroring) while
    // preserving the safer state.
    // eslint-disable-next-line no-console
    console.warn(
      "[migration 1800000000006] down() is intentionally a no-op: " +
        "reverting hasCompletedOnboarding to FALSE would re-trap every " +
        "legacy user in the onboarding wizard. See the JSDoc above for " +
        "the rationale. To actually run this down, drop the column " +
        "via migration 1800000000005's `down` instead.",
    );
    return;
  }
}
