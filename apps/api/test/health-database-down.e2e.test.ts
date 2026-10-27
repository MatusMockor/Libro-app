import type { DataSource } from 'typeorm';
import { describe, expect, inject, onTestFinished } from 'vitest';
import { test } from './support/integration-test.js';
import { PostgresServer } from './support/postgres-server.js';

const server = new PostgresServer(inject('postgres').url);

async function currentDatabase(dataSource: DataSource): Promise<string> {
  const [current] = await dataSource.query<{ name: string }[]>('SELECT current_database() AS name');

  return current?.name ?? '';
}

describe('GET /health without a database', () => {
  test('answers 503 while the database refuses connections and recovers after', async ({
    http,
    dataSource,
  }) => {
    const database = await currentDatabase(dataSource);
    expect(database).toMatch(/^test_/);

    await server.refuseConnections(database);
    onTestFinished(() => server.allowConnections(database));

    const down = await http.get('/health');

    expect(down.status).toBe(503);
    expect(down.headers['content-type']).toMatch(/^application\/json/);
    expect(down.body).toEqual({ status: 'error', checks: { database: 'down' } });

    await server.allowConnections(database);
    const up = await http.get('/health');

    expect(up.status).toBe(200);
    expect(up.body).toEqual({ status: 'ok', checks: { database: 'up' } });
  });
});
