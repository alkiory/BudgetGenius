import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UNIQUE index on `LOWER(email)` — audit finding S6 / task T0.8.
 *
 * `users.email` had no uniqueness at all: only the `id` PK was indexed. Two
 * concurrent signups with the same address both passed the service's
 * `findByEmail` pre-check (a read-then-write race) and inserted two rows; the
 * login then resolved whichever row Postgres returned first, leaving an
 * unrecoverable duplicate account.
 *
 * The index is on `LOWER(email)` rather than on `email` because addresses are
 * case-insensitive in practice (`Foo@x.com` and `foo@x.com` are the same
 * mailbox) and Postgres would happily store both. It is an INDEX and not a
 * table CONSTRAINT because an expression cannot be declared as a UNIQUE
 * constraint.
 *
 * `AuthService.signup` translates SQLSTATE `23505` (`unique_violation`) into a
 * `409 Conflict`, so the loser of the race gets the same answer as the
 * sequential "email already in use" path.
 *
 * No automatic dedupe. If a database already holds case-insensitive
 * duplicates this migration fails with `23505` and the offending values, on
 * purpose: picking a survivor means deleting an account and its transactions,
 * which is an operator decision, not something a migration should guess.
 * Find them first with:
 *
 *   SELECT lower(email), count(*) FROM bg_public.users
 *    GROUP BY 1 HAVING count(*) > 1;
 */
export class UniqueLowercaseUserEmail1800000000009
  implements MigrationInterface
{
  name = 'UniqueLowercaseUserEmail1800000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `IF NOT EXISTS` keeps the migration re-runnable (SQLSTATE 42P07 would
    // otherwise abort `migration:run` on a second apply attempt).
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_lower_email"
         ON "bg_public"."users" (LOWER("email"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "bg_public"."UQ_users_lower_email"`,
    );
  }
}
