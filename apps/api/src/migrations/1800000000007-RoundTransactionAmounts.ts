import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: round historical `transactions.amount` values to two decimals.
 *
 * The early currency-conversion flow divided amounts by a live FX rate and
 * wrote the result back to a bare `numeric` column, leaving rows like
 * `62.787499999999994`. Those values display fine (formatters round), but
 * they surfaced verbatim when editing a row and were carried forward on
 * every save. The append-only fix on the API now normalizes new writes;
 * this migration cleans the rows already stored.
 *
 * Idempotent: only rows whose value differs from its 2-decimal rounding
 * are updated, so re-running is a no-op. The `down` is intentionally a
 * no-op — the discarded precision cannot be reconstructed.
 */
export class RoundTransactionAmounts1800000000007
  implements MigrationInterface
{
  name = 'RoundTransactionAmounts1800000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "bg_public"."transactions"
       SET "amount" = ROUND("amount", 2)
       WHERE "amount" IS NOT NULL
         AND "amount" <> ROUND("amount", 2)`,
    );
  }

  public async down(): Promise<void> {
    // Irreversible data clean-up: the original float residue is gone.
  }
}
