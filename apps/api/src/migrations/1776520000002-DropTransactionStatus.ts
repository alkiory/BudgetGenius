import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropTransactionStatus1776520000002 implements MigrationInterface {
  name = 'DropTransactionStatus1776520000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bg_public"."transactions" DROP COLUMN "status"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bg_public"."transactions" ADD "status" character varying NOT NULL DEFAULT 'Completed'`,
    );
  }
}
