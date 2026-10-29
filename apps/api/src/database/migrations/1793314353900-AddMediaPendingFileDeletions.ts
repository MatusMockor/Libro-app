import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaPendingFileDeletions1793314353900 implements MigrationInterface {
  name = 'AddMediaPendingFileDeletions1793314353900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "media"."pending_file_deletions" (
                "storage_key" text NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "attempts" integer NOT NULL DEFAULT '0',
                "last_error" text,
                CONSTRAINT "pending_file_deletions_attempts_check" CHECK ("attempts" >= 0),
                CONSTRAINT "pending_file_deletions_pkey" PRIMARY KEY ("storage_key")
            )
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TABLE "media"."pending_file_deletions"
        `);
  }
}
