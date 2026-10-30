import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEncouragementsSchema1793321707143 implements MigrationInterface {
  name = 'CreateEncouragementsSchema1793321707143';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createSchema('encouragements', true);
    await queryRunner.query(`
            CREATE TABLE "encouragements"."congratulations" (
                "reading_id" uuid NOT NULL,
                "author_id" uuid NOT NULL,
                "reader_id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "congratulations_not_own_check" CHECK ("author_id" <> "reader_id"),
                CONSTRAINT "congratulations_pkey" PRIMARY KEY ("reading_id", "author_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "congratulations_reader_id_idx" ON "encouragements"."congratulations" ("reader_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "congratulations_author_id_idx" ON "encouragements"."congratulations" ("author_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "congratulations_reading_id_created_at_author_id_idx" ON "encouragements"."congratulations" ("reading_id", "created_at", "author_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "encouragements"."insights" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "reading_id" uuid NOT NULL,
                "reader_id" uuid NOT NULL,
                "author_id" uuid NOT NULL,
                "text" text NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "insights_not_own_check" CHECK ("author_id" <> "reader_id"),
                CONSTRAINT "insights_text_check" CHECK (
                    char_length("text") BETWEEN 1 AND 300
                ),
                CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "insights_reader_id_idx" ON "encouragements"."insights" ("reader_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "insights_author_id_reading_id_idx" ON "encouragements"."insights" ("author_id", "reading_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "insights_reading_id_created_at_id_idx" ON "encouragements"."insights" ("reading_id", "created_at", "id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "encouragements"."insights_reading_id_created_at_id_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "encouragements"."insights_author_id_reading_id_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "encouragements"."insights_reader_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "encouragements"."insights"
        `);
    await queryRunner.query(`
            DROP INDEX "encouragements"."congratulations_reading_id_created_at_author_id_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "encouragements"."congratulations_author_id_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "encouragements"."congratulations_reader_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "encouragements"."congratulations"
        `);
    await queryRunner.dropSchema('encouragements');
  }
}
