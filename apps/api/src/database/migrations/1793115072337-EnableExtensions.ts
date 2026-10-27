import type { MigrationInterface, QueryRunner } from 'typeorm';

const EXTENSIONS = ['postgis', 'vector', 'unaccent', 'pg_trgm'];

export class EnableExtensions1793115072337 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const extension of EXTENSIONS) {
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "${extension}" WITH SCHEMA public`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const extension of EXTENSIONS.toReversed()) {
      await queryRunner.query(`DROP EXTENSION IF EXISTS "${extension}"`);
    }
  }
}
