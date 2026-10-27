import { randomUUID } from 'node:crypto';
import { aroundAll, inject } from 'vitest';
import { PostgresServer } from './postgres-server.js';

const { url, templateDatabase } = inject('postgres');
const server = new PostgresServer(url);
const database = `test_${randomUUID().replaceAll('-', '')}`;

await server.cloneDatabase(templateDatabase, database);
process.env.DATABASE_URL = server.databaseUrl(database);

aroundAll(async (runSuite) => {
  await runSuite();
  await server.dropDatabase(database);
});
