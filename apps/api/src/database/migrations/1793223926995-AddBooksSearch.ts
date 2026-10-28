import type { MigrationInterface, QueryRunner } from 'typeorm';

const SEARCH_INDEXES = [
  { name: 'works_title_search_idx', table: 'works', column: 'title' },
  { name: 'editions_title_search_idx', table: 'editions', column: 'title' },
  { name: 'authors_name_search_idx', table: 'authors', column: 'name' },
];

export class AddBooksSearch1793223926995 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE FUNCTION "books"."search_normalise"(value text) RETURNS text
            LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
            RETURN lower(public.unaccent('public.unaccent'::regdictionary, value))
        `);
    for (const { name, table, column } of SEARCH_INDEXES) {
      await queryRunner.query(`
            CREATE INDEX "${name}" ON "books"."${table}"
            USING gin ("books"."search_normalise"("${column}") public.gin_trgm_ops)
        `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { name } of SEARCH_INDEXES.toReversed()) {
      await queryRunner.query(`DROP INDEX "books"."${name}"`);
    }
    await queryRunner.query(`DROP FUNCTION "books"."search_normalise"(text)`);
  }
}
