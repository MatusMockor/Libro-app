import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import cliDataSource from '../src/database/data-source.js';

const EXTENSIONS = ['pg_trgm', 'postgis', 'unaccent', 'vector'];
const MODULE_TABLES = [
  'auth.users',
  'books.authors',
  'books.editions',
  'books.work_authors',
  'books.works',
];
const MODULE_SCHEMAS = ['auth', 'books'];

async function installedExtensions(dataSource: DataSource): Promise<string[]> {
  const rows: { extname: string }[] = await dataSource.query(
    'SELECT extname FROM pg_extension WHERE extname = ANY($1) ORDER BY extname',
    [EXTENSIONS],
  );

  return rows.map((row) => row.extname);
}

async function moduleTables(dataSource: DataSource): Promise<string[]> {
  const rows: { name: string }[] = await dataSource.query(
    `SELECT table_schema || '.' || table_name AS name
     FROM information_schema.tables
     WHERE table_schema = ANY($1)
     ORDER BY name`,
    [MODULE_SCHEMAS],
  );

  return rows.map((row) => row.name);
}

async function schemaExists(dataSource: DataSource, schema: string): Promise<boolean> {
  const rows: unknown[] = await dataSource.query(
    'SELECT 1 FROM information_schema.schemata WHERE schema_name = $1',
    [schema],
  );

  return rows.length > 0;
}

async function revertAllMigrations(dataSource: DataSource): Promise<void> {
  for (let step = 0; step < dataSource.migrations.length; step += 1) {
    await dataSource.undoLastMigration();
  }
}

describe('database migrations', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await cliDataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('enables the required extensions', async () => {
    await dataSource.runMigrations();

    expect(await installedExtensions(dataSource)).toEqual(EXTENSIONS);
  });

  it('creates the module schemas with their tables', async () => {
    await dataSource.runMigrations();

    expect(await moduleTables(dataSource)).toEqual(MODULE_TABLES);
  });

  it('removes the extensions and module schemas when every migration is reverted', async () => {
    await dataSource.runMigrations();
    await revertAllMigrations(dataSource);

    expect(await installedExtensions(dataSource)).toEqual([]);
    for (const schema of MODULE_SCHEMAS) {
      expect(await schemaExists(dataSource, schema)).toBe(false);
    }
    expect(await dataSource.showMigrations()).toBe(true);
  });

  it('re-applies every migration after a full revert', async () => {
    await revertAllMigrations(dataSource);
    await dataSource.runMigrations();

    expect(await installedExtensions(dataSource)).toEqual(EXTENSIONS);
    expect(await moduleTables(dataSource)).toEqual(MODULE_TABLES);
    expect(await dataSource.showMigrations()).toBe(false);
  });
});
