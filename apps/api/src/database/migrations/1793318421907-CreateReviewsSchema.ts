import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReviewsSchema1793318421907 implements MigrationInterface {
  name = 'CreateReviewsSchema1793318421907';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createSchema('reviews', true);
    await queryRunner.query(`
            CREATE TABLE "reviews"."reviews" (
                "reading_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "work_id" uuid NOT NULL,
                "rating" smallint NOT NULL,
                "text" text,
                "finished_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "reviews_text_check" CHECK (
                    char_length("text") BETWEEN 1 AND 1000
                ),
                CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
                CONSTRAINT "reviews_pkey" PRIMARY KEY ("reading_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "reviews_user_id_created_at_reading_id_idx" ON "reviews"."reviews" ("user_id", "created_at", "reading_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "reviews_work_id_user_id_created_at_reading_id_idx" ON "reviews"."reviews" ("work_id", "user_id", "created_at", "reading_id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "reviews"."reviews_work_id_user_id_created_at_reading_id_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "reviews"."reviews_user_id_created_at_reading_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "reviews"."reviews"
        `);
    await queryRunner.dropSchema('reviews');
  }
}
