import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTreeSchema1793229219558 implements MigrationInterface {
  name = 'CreateTreeSchema1793229219558';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createSchema('tree', true);
    await queryRunner.query(`
            CREATE TABLE "tree"."finished_trees" (
                "reading_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "tree_engine_version" smallint NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "finished_trees_tree_engine_version_check" CHECK ("tree_engine_version" > 0),
                CONSTRAINT "finished_trees_pkey" PRIMARY KEY ("reading_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "finished_trees_user_id_idx" ON "tree"."finished_trees" ("user_id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "tree"."finished_trees_user_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "tree"."finished_trees"
        `);
    await queryRunner.dropSchema('tree');
  }
}
