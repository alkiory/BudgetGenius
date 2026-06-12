import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1776510954066 implements MigrationInterface {
    name = 'InitialMigration1776510954066'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "bg_public"."budget_categories" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "allocated" numeric NOT NULL, "spent" numeric NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "budgetId" integer, CONSTRAINT "PK_2159c4d6372542f4629c4149045" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "bg_public"."budgets" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "period" character varying NOT NULL, "startDate" date NOT NULL, "endDate" date NOT NULL, "totalAllocated" numeric NOT NULL, "totalSpent" numeric NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_9c8a51748f82387644b773da482" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "bg_public"."transactions" ("id" SERIAL NOT NULL, "date" date NOT NULL, "description" character varying NOT NULL, "category" character varying NOT NULL, "amount" numeric NOT NULL, "status" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "bg_public"."expense_categories" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "value" numeric NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_d0ef31e189d9523461215b62775" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "bg_public"."overview" ("id" SERIAL NOT NULL, "balance" numeric NOT NULL, "income" numeric NOT NULL, "expenses" numeric NOT NULL, "period" date NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_f548f35b9b16cfb0256ada16dfe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "bg_public"."saving_goals" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "current" numeric NOT NULL, "target" numeric NOT NULL, "percentage" numeric NOT NULL, "targetDate" date, "category" character varying NOT NULL, "color" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_5193f14c1c3a38e6657a159795e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "bg_public"."user_settings" ("id" SERIAL NOT NULL, "timezone" character varying NOT NULL, "currency" character varying NOT NULL, "locale" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_00f004f5922a0744d174530d639" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "bg_public"."incomes" ("id" SERIAL NOT NULL, "date" date NOT NULL, "description" character varying NOT NULL, "amount" numeric NOT NULL, "category" character varying NOT NULL, "recurrence" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_d737b3d0314c1f0da5461a55e5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "bg_public"."goals" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying NOT NULL, "targetAmount" numeric NOT NULL, "currentAmount" numeric NOT NULL, "startDate" date NOT NULL, "dueDate" date NOT NULL, "status" character varying NOT NULL DEFAULT 'active', "type" character varying DEFAULT 'short-term', "contributionFrequency" character varying DEFAULT 'monthly', "notes" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_26e17b251afab35580dff769223" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "bg_public"."users" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "surname" character varying, "email" character varying NOT NULL, "password" character varying, "authProvider" character varying NOT NULL DEFAULT 'email', "role" character varying NOT NULL, "refreshToken" character varying, "isPremium" boolean NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "bg_public"."password_reset_tokens" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "token" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "bg_public"."budget_categories" ADD CONSTRAINT "FK_c34b1887af1a23bc6a1c2ebf1dd" FOREIGN KEY ("budgetId") REFERENCES "bg_public"."budgets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bg_public"."budgets" ADD CONSTRAINT "FK_27e688ddf1ff3893b43065899f9" FOREIGN KEY ("userId") REFERENCES "bg_public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bg_public"."transactions" ADD CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41" FOREIGN KEY ("userId") REFERENCES "bg_public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bg_public"."expense_categories" ADD CONSTRAINT "FK_4cf47e0ed046fcb17f87dfacef5" FOREIGN KEY ("userId") REFERENCES "bg_public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bg_public"."overview" ADD CONSTRAINT "FK_3d6143903b887786c7f94c338c8" FOREIGN KEY ("userId") REFERENCES "bg_public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bg_public"."saving_goals" ADD CONSTRAINT "FK_7a034e565511204ca32cafadbb8" FOREIGN KEY ("userId") REFERENCES "bg_public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bg_public"."user_settings" ADD CONSTRAINT "FK_986a2b6d3c05eb4091bb8066f78" FOREIGN KEY ("userId") REFERENCES "bg_public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bg_public"."incomes" ADD CONSTRAINT "FK_f6b7c6bbe04a203dfc67ae627ab" FOREIGN KEY ("userId") REFERENCES "bg_public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bg_public"."goals" ADD CONSTRAINT "FK_57dd8a3fc26eb760d076bf8840e" FOREIGN KEY ("userId") REFERENCES "bg_public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bg_public"."goals" DROP CONSTRAINT "FK_57dd8a3fc26eb760d076bf8840e"`);
        await queryRunner.query(`ALTER TABLE "bg_public"."incomes" DROP CONSTRAINT "FK_f6b7c6bbe04a203dfc67ae627ab"`);
        await queryRunner.query(`ALTER TABLE "bg_public"."user_settings" DROP CONSTRAINT "FK_986a2b6d3c05eb4091bb8066f78"`);
        await queryRunner.query(`ALTER TABLE "bg_public"."saving_goals" DROP CONSTRAINT "FK_7a034e565511204ca32cafadbb8"`);
        await queryRunner.query(`ALTER TABLE "bg_public"."overview" DROP CONSTRAINT "FK_3d6143903b887786c7f94c338c8"`);
        await queryRunner.query(`ALTER TABLE "bg_public"."expense_categories" DROP CONSTRAINT "FK_4cf47e0ed046fcb17f87dfacef5"`);
        await queryRunner.query(`ALTER TABLE "bg_public"."transactions" DROP CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41"`);
        await queryRunner.query(`ALTER TABLE "bg_public"."budgets" DROP CONSTRAINT "FK_27e688ddf1ff3893b43065899f9"`);
        await queryRunner.query(`ALTER TABLE "bg_public"."budget_categories" DROP CONSTRAINT "FK_c34b1887af1a23bc6a1c2ebf1dd"`);
        await queryRunner.query(`DROP TABLE "bg_public"."password_reset_tokens"`);
        await queryRunner.query(`DROP TABLE "bg_public"."users"`);
        await queryRunner.query(`DROP TABLE "bg_public"."goals"`);
        await queryRunner.query(`DROP TABLE "bg_public"."incomes"`);
        await queryRunner.query(`DROP TABLE "bg_public"."user_settings"`);
        await queryRunner.query(`DROP TABLE "bg_public"."saving_goals"`);
        await queryRunner.query(`DROP TABLE "bg_public"."overview"`);
        await queryRunner.query(`DROP TABLE "bg_public"."expense_categories"`);
        await queryRunner.query(`DROP TABLE "bg_public"."transactions"`);
        await queryRunner.query(`DROP TABLE "bg_public"."budgets"`);
        await queryRunner.query(`DROP TABLE "bg_public"."budget_categories"`);
    }

}
