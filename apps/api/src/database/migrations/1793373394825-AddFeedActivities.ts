import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeedActivities1793373394825 implements MigrationInterface {
  name = 'AddFeedActivities1793373394825';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "feed"."activities" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "actor_id" uuid NOT NULL,
                "kind" text NOT NULL,
                "post_id" uuid,
                "reading_id" uuid,
                "work_id" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "activities_kind_reading_id_key" UNIQUE ("kind", "reading_id"),
                CONSTRAINT "activities_post_id_key" UNIQUE ("post_id"),
                CONSTRAINT "activities_shape_check" CHECK (
                    (
                        "kind" = 'post'
                        AND "post_id" IS NOT NULL
                        AND "reading_id" IS NULL
                        AND "work_id" IS NULL
                    )
                    OR (
                        "kind" <> 'post'
                        AND "post_id" IS NULL
                        AND "reading_id" IS NOT NULL
                        AND "work_id" IS NOT NULL
                    )
                ),
                CONSTRAINT "activities_kind_check" CHECK (
                    "kind" IN ('post', 'reading_started', 'book_finished')
                ),
                CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "activities_created_at_id_idx" ON "feed"."activities" ("created_at", "id")
        `);
    await queryRunner.query(`
            CREATE INDEX "activities_actor_id_created_at_id_idx" ON "feed"."activities" ("actor_id", "created_at", "id")
        `);
    await queryRunner.query(`
            ALTER TABLE "profiles"."profiles"
            ADD "official" boolean NOT NULL DEFAULT false
        `);
    await queryRunner.query(`
            ALTER TABLE "reading"."sharing_settings"
            ADD "reading_activity" text NOT NULL DEFAULT 'followers'
        `);
    await queryRunner.query(`
            CREATE INDEX "profiles_official_idx" ON "profiles"."profiles" ("user_id")
            WHERE "official"
        `);
    await queryRunner.query(`
            ALTER TABLE "reading"."sharing_settings"
            ADD CONSTRAINT "sharing_settings_reading_activity_check" CHECK ("reading_activity" IN ('followers', 'nobody'))
        `);
    await queryRunner.query(`
            ALTER TABLE "feed"."activities"
            ADD CONSTRAINT "activities_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "feed"."posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            INSERT INTO "feed"."activities" ("actor_id", "kind", "post_id", "created_at")
            SELECT "author_id", 'post', "id", "created_at"
            FROM "feed"."posts"
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "feed"."activities" DROP CONSTRAINT "activities_post_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "reading"."sharing_settings" DROP CONSTRAINT "sharing_settings_reading_activity_check"
        `);
    await queryRunner.query(`
            DROP INDEX "profiles"."profiles_official_idx"
        `);
    await queryRunner.query(`
            ALTER TABLE "reading"."sharing_settings" DROP COLUMN "reading_activity"
        `);
    await queryRunner.query(`
            ALTER TABLE "profiles"."profiles" DROP COLUMN "official"
        `);
    await queryRunner.query(`
            DROP INDEX "feed"."activities_actor_id_created_at_id_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "feed"."activities_created_at_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "feed"."activities"
        `);
  }
}
