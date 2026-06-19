import { MigrationInterface, QueryRunner } from 'typeorm';

// Phase-6.8-x: the `goals` table was orphaned when the Goal entity +
// service + controller + repository were removed from the codebase.
// The frontend `goalsPage.tsx` was already gone, and
// `apps/api/src/domain/user/user.entity.ts` no longer declares a
// `@OneToMany(() => Goal) goals` relation, so the FK
// `FK_57dd8a3fc26eb760d076bf8840e` (goals.userId → users.id) is the
// only remaining inbound constraint on the orphaned table. The
// constraint hash-name comes from InitialMigration 1776510954066 —
// verify via `\d bg_public.goals` if a future schema regen ever
// renames it. `CASCADE` drops both the table and its FK (plus any
// future derived views/sequences/indexes) in a single statement, so
// `migration:run` is idempotent and atomic.
//
// `down()` recreates the goals table exactly as InitialMigration
// 1776510954066 defined it, so `migration:revert` is symmetrically
// safe.
export class RemoveGoalsTable1800000000000 implements MigrationInterface {
  name = 'RemoveGoalsTable1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bg_public"."goals" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "bg_public"."goals" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying NOT NULL,
        "targetAmount" numeric NOT NULL,
        "currentAmount" numeric NOT NULL,
        "startDate" date NOT NULL,
        "dueDate" date NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "type" character varying DEFAULT 'short-term',
        "contributionFrequency" character varying DEFAULT 'monthly',
        "notes" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" integer,
        CONSTRAINT "PK_26e17b251afab35580dff769223" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "bg_public"."goals" ADD CONSTRAINT "FK_57dd8a3fc26eb760d076bf8840e" FOREIGN KEY ("userId") REFERENCES "bg_public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
