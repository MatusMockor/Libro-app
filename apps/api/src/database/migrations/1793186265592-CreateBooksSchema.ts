import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBooksSchema1793186265592 implements MigrationInterface {
  name = 'CreateBooksSchema1793186265592';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createSchema('books', true);
    await queryRunner.query(`
            CREATE TABLE "books"."authors" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "name" text NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "authors_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "books"."work_authors" (
                "work_id" uuid NOT NULL,
                "author_id" uuid NOT NULL,
                "position" smallint NOT NULL,
                CONSTRAINT "work_authors_work_id_position_key" UNIQUE ("work_id", "position"),
                CONSTRAINT "work_authors_position_check" CHECK ("position" > 0),
                CONSTRAINT "work_authors_pkey" PRIMARY KEY ("work_id", "author_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "work_authors_author_id_idx" ON "books"."work_authors" ("author_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "books"."works" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "title" text NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "works_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "books"."editions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "isbn13" character(13),
                "language" text NOT NULL,
                "title" text,
                "published_year" smallint,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "work_id" uuid NOT NULL,
                CONSTRAINT "editions_isbn13_key" UNIQUE ("isbn13"),
                CONSTRAINT "editions_language_check" CHECK ("language" ~ '^[a-z]{2}$'),
                CONSTRAINT "editions_isbn13_check" CHECK ("isbn13" ~ '^[0-9]{13}$'),
                CONSTRAINT "editions_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "editions_work_id_idx" ON "books"."editions" ("work_id")
        `);
    await queryRunner.query(`
            ALTER TABLE "books"."work_authors"
            ADD CONSTRAINT "work_authors_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "books"."works"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "books"."work_authors"
            ADD CONSTRAINT "work_authors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "books"."authors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "books"."editions"
            ADD CONSTRAINT "editions_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "books"."works"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "books"."editions" DROP CONSTRAINT "editions_work_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "books"."work_authors" DROP CONSTRAINT "work_authors_author_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "books"."work_authors" DROP CONSTRAINT "work_authors_work_id_fkey"
        `);
    await queryRunner.query(`
            DROP INDEX "books"."editions_work_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "books"."editions"
        `);
    await queryRunner.query(`
            DROP TABLE "books"."works"
        `);
    await queryRunner.query(`
            DROP INDEX "books"."work_authors_author_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "books"."work_authors"
        `);
    await queryRunner.query(`
            DROP TABLE "books"."authors"
        `);
    await queryRunner.dropSchema('books');
  }
}
