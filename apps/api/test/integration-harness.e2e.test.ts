import { describe, expect } from 'vitest';
import { test } from './support/integration-test.js';

interface Note {
  id: number;
  body: string;
}

describe('integration test harness', () => {
  test.beforeAll(async ({ dataSource }) => {
    await dataSource.query('CREATE SCHEMA harness_probe');
    await dataSource.query(
      'CREATE TABLE harness_probe.notes (id serial PRIMARY KEY, body text NOT NULL UNIQUE)',
    );
    await dataSource.query('INSERT INTO harness_probe.notes (body) VALUES ($1)', ['left over']);
  });

  test('serves the full app over HTTP', async ({ http }) => {
    const response = await http.get('/health');

    expect(response.status).toBe(200);
  });

  test('writes and reads through the app DataSource', async ({ dataSource }) => {
    await dataSource.query('INSERT INTO harness_probe.notes (body) VALUES ($1)', ['same note']);

    const notes = await dataSource.query<Note[]>('SELECT id, body FROM harness_probe.notes');

    expect(notes).toEqual([{ id: 1, body: 'same note' }]);
  });

  test('starts every test with empty tables and reset identities', async ({ dataSource }) => {
    expect(await dataSource.query('SELECT id FROM harness_probe.notes')).toEqual([]);

    await dataSource.query('INSERT INTO harness_probe.notes (body) VALUES ($1)', ['same note']);

    const notes = await dataSource.query<Note[]>('SELECT id, body FROM harness_probe.notes');

    expect(notes).toEqual([{ id: 1, body: 'same note' }]);
  });

  test('keeps the migration history and extension data', async ({ dataSource }) => {
    const [counts] = await dataSource.query<{ migrations: number; spatialRefs: number }[]>(
      `SELECT
         (SELECT count(*)::int FROM public.migrations) AS "migrations",
         (SELECT count(*)::int FROM public.spatial_ref_sys) AS "spatialRefs"`,
    );

    expect(counts?.migrations).toBeGreaterThan(0);
    expect(counts?.spatialRefs).toBeGreaterThan(0);
  });

  test('runs on its own database cloned from the migrated template', async ({ dataSource }) => {
    const [database] = await dataSource.query<{ name: string }[]>(
      'SELECT current_database() AS name',
    );

    expect(database?.name).toMatch(/^test_[0-9a-f]{32}$/);
  });
});
