import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReadingGroups1793316483485 implements MigrationInterface {
  name = 'AddReadingGroups1793316483485';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "reading"."session_participants" (
                "participant_session_id" uuid NOT NULL,
                "host_session_id" uuid NOT NULL,
                "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "left_at" TIMESTAMP WITH TIME ZONE,
                "removed_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "session_participants_removed_at_check" CHECK ("removed_at" >= "joined_at"),
                CONSTRAINT "session_participants_left_at_check" CHECK ("left_at" >= "joined_at"),
                CONSTRAINT "session_participants_not_self_check" CHECK ("host_session_id" <> "participant_session_id"),
                CONSTRAINT "session_participants_pkey" PRIMARY KEY ("participant_session_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "session_participants_host_session_id_idx" ON "reading"."session_participants" ("host_session_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "reading"."sharing_settings" (
                "user_id" uuid NOT NULL,
                "live_sessions" text NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "sharing_settings_live_sessions_check" CHECK ("live_sessions" IN ('followers', 'nobody')),
                CONSTRAINT "sharing_settings_pkey" PRIMARY KEY ("user_id")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "reading"."session_participants"
            ADD CONSTRAINT "session_participants_participant_session_id_fkey" FOREIGN KEY ("participant_session_id") REFERENCES "reading"."sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "reading"."session_participants"
            ADD CONSTRAINT "session_participants_host_session_id_fkey" FOREIGN KEY ("host_session_id") REFERENCES "reading"."sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "reading"."session_participants" DROP CONSTRAINT "session_participants_host_session_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "reading"."session_participants" DROP CONSTRAINT "session_participants_participant_session_id_fkey"
        `);
    await queryRunner.query(`
            DROP TABLE "reading"."sharing_settings"
        `);
    await queryRunner.query(`
            DROP INDEX "reading"."session_participants_host_session_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "reading"."session_participants"
        `);
  }
}
