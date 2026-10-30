import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhotos1793320471975 implements MigrationInterface {
  name = 'AddPhotos1793320471975';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "feed"."post_photos" (
                "post_id" uuid NOT NULL,
                "position" smallint NOT NULL,
                "media_id" uuid NOT NULL,
                CONSTRAINT "post_photos_post_id_media_id_key" UNIQUE ("post_id", "media_id"),
                CONSTRAINT "post_photos_position_check" CHECK (
                    "position" BETWEEN 1 AND 4
                ),
                CONSTRAINT "post_photos_pkey" PRIMARY KEY ("post_id", "position")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "reviews"."reviews"
            ADD "photo_media_id" uuid
        `);
    await queryRunner.query(`
            ALTER TABLE "feed"."posts"
            ALTER COLUMN "text" DROP NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "feed"."post_photos"
            ADD CONSTRAINT "post_photos_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "feed"."posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "feed"."post_photos" DROP CONSTRAINT "post_photos_post_id_fkey"
        `);
    await queryRunner.query(`
            UPDATE "feed"."posts"
            SET "text" = '📷'
            WHERE "text" IS NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "feed"."posts"
            ALTER COLUMN "text"
            SET NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "reviews"."reviews" DROP COLUMN "photo_media_id"
        `);
    await queryRunner.query(`
            DROP TABLE "feed"."post_photos"
        `);
  }
}
