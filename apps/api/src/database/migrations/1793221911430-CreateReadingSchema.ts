import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReadingSchema1793221911430 implements MigrationInterface {
  name = 'CreateReadingSchema1793221911430';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createSchema('reading', true);
    await queryRunner.query(`
            CREATE TABLE "reading"."readings" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "work_id" uuid NOT NULL,
                "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "finished_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "readings_finished_at_check" CHECK ("finished_at" >= "started_at"),
                CONSTRAINT "readings_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "readings_unfinished_user_id_work_id_key" ON "reading"."readings" ("user_id", "work_id")
            WHERE "finished_at" IS NULL
        `);
    await queryRunner.query(`
            CREATE TABLE "reading"."sessions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "reading_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "place" text,
                "status" text NOT NULL,
                "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "ended_at" TIMESTAMP WITH TIME ZONE,
                "active_seconds" double precision NOT NULL DEFAULT '0',
                "active_since" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "sessions_ended_at_check" CHECK (("status" = 'ended') = ("ended_at" IS NOT NULL)),
                CONSTRAINT "sessions_active_since_check" CHECK (
                    ("status" = 'active') = ("active_since" IS NOT NULL)
                ),
                CONSTRAINT "sessions_active_seconds_check" CHECK ("active_seconds" >= 0),
                CONSTRAINT "sessions_place_check" CHECK (
                    char_length("place") BETWEEN 1 AND 100
                ),
                CONSTRAINT "sessions_status_check" CHECK ("status" IN ('active', 'paused', 'ended')),
                CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "sessions_reading_id_idx" ON "reading"."sessions" ("reading_id")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "sessions_open_user_id_key" ON "reading"."sessions" ("user_id")
            WHERE "status" <> 'ended'
        `);
    await queryRunner.query(`
            CREATE TABLE "reading"."checkpoints" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "session_id" uuid NOT NULL,
                "page" integer NOT NULL,
                "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "checkpoints_page_check" CHECK ("page" > 0),
                CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "checkpoints_session_id_idx" ON "reading"."checkpoints" ("session_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "reading"."marked_parts" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "session_id" uuid NOT NULL,
                "kind" text NOT NULL,
                "from_page" integer NOT NULL,
                "to_page" integer NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "marked_parts_to_page_check" CHECK ("to_page" >= "from_page"),
                CONSTRAINT "marked_parts_from_page_check" CHECK ("from_page" > 0),
                CONSTRAINT "marked_parts_kind_check" CHECK ("kind" IN ('good', 'slow', 'skipped')),
                CONSTRAINT "marked_parts_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "marked_parts_session_id_idx" ON "reading"."marked_parts" ("session_id")
        `);
    await queryRunner.query(`
            ALTER TABLE "reading"."sessions"
            ADD CONSTRAINT "sessions_reading_id_fkey" FOREIGN KEY ("reading_id") REFERENCES "reading"."readings"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "reading"."checkpoints"
            ADD CONSTRAINT "checkpoints_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "reading"."sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "reading"."marked_parts"
            ADD CONSTRAINT "marked_parts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "reading"."sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "reading"."marked_parts" DROP CONSTRAINT "marked_parts_session_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "reading"."checkpoints" DROP CONSTRAINT "checkpoints_session_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "reading"."sessions" DROP CONSTRAINT "sessions_reading_id_fkey"
        `);
    await queryRunner.query(`
            DROP INDEX "reading"."marked_parts_session_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "reading"."marked_parts"
        `);
    await queryRunner.query(`
            DROP INDEX "reading"."checkpoints_session_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "reading"."checkpoints"
        `);
    await queryRunner.query(`
            DROP INDEX "reading"."sessions_open_user_id_key"
        `);
    await queryRunner.query(`
            DROP INDEX "reading"."sessions_reading_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "reading"."sessions"
        `);
    await queryRunner.query(`
            DROP INDEX "reading"."readings_unfinished_user_id_work_id_key"
        `);
    await queryRunner.query(`
            DROP TABLE "reading"."readings"
        `);
    await queryRunner.dropSchema('reading');
  }
}
