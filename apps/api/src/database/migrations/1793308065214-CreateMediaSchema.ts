import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMediaSchema1793308065214 implements MigrationInterface {
  name = 'CreateMediaSchema1793308065214';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createSchema('media', true);
    await queryRunner.query(`
            CREATE TABLE "media"."files" (
                "id" uuid NOT NULL,
                "owner_id" uuid NOT NULL,
                "width" integer NOT NULL,
                "height" integer NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "files_height_check" CHECK ("height" > 0),
                CONSTRAINT "files_width_check" CHECK ("width" > 0),
                CONSTRAINT "files_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "files_owner_id_idx" ON "media"."files" ("owner_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "media"."file_variants" (
                "file_id" uuid NOT NULL,
                "name" text NOT NULL,
                "storage_key" text NOT NULL,
                "width" integer NOT NULL,
                "height" integer NOT NULL,
                "byte_size" integer NOT NULL,
                CONSTRAINT "file_variants_storage_key_key" UNIQUE ("storage_key"),
                CONSTRAINT "file_variants_byte_size_check" CHECK ("byte_size" > 0),
                CONSTRAINT "file_variants_height_check" CHECK ("height" > 0),
                CONSTRAINT "file_variants_width_check" CHECK ("width" > 0),
                CONSTRAINT "file_variants_name_check" CHECK ("name" IN ('small', 'medium', 'large')),
                CONSTRAINT "file_variants_pkey" PRIMARY KEY ("file_id", "name")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "media"."file_variants"
            ADD CONSTRAINT "file_variants_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "media"."files"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "media"."file_variants" DROP CONSTRAINT "file_variants_file_id_fkey"
        `);
    await queryRunner.query(`
            DROP TABLE "media"."file_variants"
        `);
    await queryRunner.query(`
            DROP INDEX "media"."files_owner_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "media"."files"
        `);
    await queryRunner.dropSchema('media');
  }
}
