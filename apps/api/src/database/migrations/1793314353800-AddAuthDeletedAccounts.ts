import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthDeletedAccounts1793314353800 implements MigrationInterface {
  name = 'AddAuthDeletedAccounts1793314353800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "auth"."deleted_accounts" (
                "user_id" uuid NOT NULL,
                "deleted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "deleted_accounts_pkey" PRIMARY KEY ("user_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "deleted_accounts_deleted_at_idx" ON "auth"."deleted_accounts" ("deleted_at")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "auth"."deleted_accounts_deleted_at_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "auth"."deleted_accounts"
        `);
  }
}
