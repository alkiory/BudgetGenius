import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Idempotent transaction imports.
 *
 * `POST /transactions/import` is retried by clients and proxies after a
 * timeout. Without a durable receipt, every retry inserts the whole extract
 * again. A receipt keyed by `(userId, idempotencyKey)` stores the payload
 * hash so the server can:
 *
 * - replay the original outcome when the same key + payload arrives again;
 * - reject a reused key with a different payload (409) instead of silently
 *   returning a stale result.
 *
 * The receipt row is written in the same transaction as the transaction
 * rows, so a crash can never leave a "success" receipt without its data.
 * `ON DELETE CASCADE` keeps the table clean when the account is deleted.
 */
export class TransactionImportReceipts1800000000014
  implements MigrationInterface
{
  name = 'TransactionImportReceipts1800000000014';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "bg_public"."transaction_import_receipts" (
        "id" serial PRIMARY KEY,
        "userId" integer NOT NULL
          REFERENCES "bg_public"."users" ("id") ON DELETE CASCADE,
        "idempotencyKey" character varying(128) NOT NULL,
        "payloadHash" character varying(64) NOT NULL,
        "createdCount" integer NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_transaction_import_receipts_user_key"
          UNIQUE ("userId", "idempotencyKey")
      )
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(
      `DROP TABLE IF EXISTS "bg_public"."transaction_import_receipts"`,
    );
  }
}
