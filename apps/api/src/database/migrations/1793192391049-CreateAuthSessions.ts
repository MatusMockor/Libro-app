import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthSessions1793192391049 implements MigrationInterface {
  name = 'CreateAuthSessions1793192391049';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "auth"."sessions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "revoked_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" ("user_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "auth"."refresh_tokens" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "token_hash" character(64) NOT NULL,
                "revoked_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "session_id" uuid NOT NULL,
                CONSTRAINT "refresh_tokens_token_hash_key" UNIQUE ("token_hash"),
                CONSTRAINT "refresh_tokens_token_hash_check" CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
                CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "refresh_tokens_session_id_idx" ON "auth"."refresh_tokens" ("session_id")
        `);
    await queryRunner.query(`
            ALTER TABLE "auth"."sessions"
            ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "auth"."refresh_tokens"
            ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "auth"."refresh_tokens" DROP CONSTRAINT "refresh_tokens_session_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "auth"."sessions" DROP CONSTRAINT "sessions_user_id_fkey"
        `);
    await queryRunner.query(`
            DROP INDEX "auth"."refresh_tokens_session_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "auth"."refresh_tokens"
        `);
    await queryRunner.query(`
            DROP INDEX "auth"."sessions_user_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "auth"."sessions"
        `);
  }
}
