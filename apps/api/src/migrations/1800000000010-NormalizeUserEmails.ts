import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Canonicalises existing `users.email` values to `LOWER(TRIM(email))`.
 *
 * Companion of `1800000000009-UniqueLowercaseUserEmail`: from that migration
 * on, the database refuses a second account that only differs in casing, and
 * `UserRepositoryImpl` reads/writes the canonical form. Rows created before
 * those changes may still hold `Foo@X.com`, which would never match a lookup
 * for `foo@x.com`.
 *
 * Safe by construction: the `UQ_users_lower_email` index already guarantees
 * that no two rows share a `LOWER(email)`, so lowering the stored values cannot
 * create a duplicate. Rows already canonical are left untouched, which keeps
 * the statement idempotent and avoids a pointless rewrite of every row.
 *
 * `down()` is a no-op on purpose: the original casing is not recoverable. That
 * is acceptable because the canonical form is the intended state, not a
 * transient one.
 */
export class NormalizeUserEmails1800000000010 implements MigrationInterface {
  name = 'NormalizeUserEmails1800000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "bg_public"."users"
          SET "email" = LOWER(TRIM("email"))
        WHERE "email" <> LOWER(TRIM("email"))`,
    );
  }

  public async down(): Promise<void> {
    // Not reversible: the pre-normalisation casing is gone.
  }
}
