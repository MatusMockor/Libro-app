import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthSchema1793188964351 implements MigrationInterface {
  name = 'CreateAuthSchema1793188964351';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createSchema('auth', true);
    await queryRunner.query(`
            CREATE TABLE "auth"."users" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "email" text NOT NULL,
                "password_hash" text NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "users_email_key" UNIQUE ("email"),
                CONSTRAINT "users_email_check" CHECK ("email" = lower("email")),
                CONSTRAINT "users_pkey" PRIMARY KEY ("id")
            )
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TABLE "auth"."users"
        `);
    await queryRunner.dropSchema('auth');
  }
}
