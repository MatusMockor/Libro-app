import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import cliDataSource from '../src/database/data-source.js';

const EXTENSIONS = ['pg_trgm', 'postgis', 'unaccent', 'vector'];

async function installedExtensions(dataSource: DataSource): Promise<string[]> {
  const rows: { extname: string }[] = await dataSource.query(
    'SELECT extname FROM pg_extension WHERE extname = ANY($1) ORDER BY extname',
    [EXTENSIONS],
  );

  return rows.map((row) => row.extname);
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

  it('removes the extensions when every migration is reverted', async () => {
    await dataSource.runMigrations();
    await revertAllMigrations(dataSource);

    expect(await installedExtensions(dataSource)).toEqual([]);
    expect(await dataSource.showMigrations()).toBe(true);
  });

  it('re-applies every migration after a full revert', async () => {
    await revertAllMigrations(dataSource);
    await dataSource.runMigrations();

    expect(await installedExtensions(dataSource)).toEqual(EXTENSIONS);
    expect(await dataSource.showMigrations()).toBe(false);
  });
});
