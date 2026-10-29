import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeedSchema1793315013603 implements MigrationInterface {
  name = 'CreateFeedSchema1793315013603';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createSchema('feed', true);
    await queryRunner.query(`
            CREATE TABLE "feed"."posts" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "author_id" uuid NOT NULL,
                "text" text NOT NULL,
                "work_id" uuid,
                "place" text,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "posts_place_check" CHECK (
                    char_length("place") BETWEEN 1 AND 100
                ),
                CONSTRAINT "posts_text_check" CHECK (
                    char_length("text") BETWEEN 1 AND 2000
                ),
                CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "posts_author_id_created_at_id_idx" ON "feed"."posts" ("author_id", "created_at", "id")
        `);
    await queryRunner.query(`
            CREATE INDEX "posts_created_at_id_idx" ON "feed"."posts" ("created_at", "id")
        `);
    await queryRunner.query(`
            CREATE TABLE "feed"."likes" (
                "post_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "likes_pkey" PRIMARY KEY ("post_id", "user_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "feed"."reactions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "post_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "reaction" text NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "reactions_post_id_user_id_reaction_key" UNIQUE ("post_id", "user_id", "reaction"),
                CONSTRAINT "reactions_reaction_check" CHECK (
                    "reaction" IN (
                        'heart',
                        'books',
                        'clap',
                        'wow',
                        'laugh',
                        'hug',
                        'thinking'
                    )
                ),
                CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "reactions_post_id_created_at_id_idx" ON "feed"."reactions" ("post_id", "created_at", "id")
        `);
    await queryRunner.query(`
            ALTER TABLE "feed"."likes"
            ADD CONSTRAINT "likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "feed"."posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "feed"."reactions"
            ADD CONSTRAINT "reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "feed"."posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "feed"."reactions" DROP CONSTRAINT "reactions_post_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "feed"."likes" DROP CONSTRAINT "likes_post_id_fkey"
        `);
    await queryRunner.query(`
            DROP INDEX "feed"."reactions_post_id_created_at_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "feed"."reactions"
        `);
    await queryRunner.query(`
            DROP TABLE "feed"."likes"
        `);
    await queryRunner.query(`
            DROP INDEX "feed"."posts_created_at_id_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "feed"."posts_author_id_created_at_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "feed"."posts"
        `);
    await queryRunner.dropSchema('feed');
  }
}
