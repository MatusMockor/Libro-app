import '@oxc-node/core/register';
import { DataSource } from 'typeorm';
import type { TestProject } from 'vitest/node';
import { dataSourceOptions } from '../../src/database/data-source.options.js';
import { startPostgresContainer } from './postgres-container.js';
import { PostgresServer } from './postgres-server.js';

const TEMPLATE_DATABASE = 'libro_template';

declare module 'vitest' {
  export interface ProvidedContext {
    postgres: { url: string; templateDatabase: string };
  }
}

async function migrate(url: string): Promise<void> {
  const dataSource = await new DataSource(dataSourceOptions(url)).initialize();

  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container = await startPostgresContainer();
  const server = new PostgresServer(container.getConnectionUri());

  await server.createDatabase(TEMPLATE_DATABASE);
  await migrate(server.databaseUrl(TEMPLATE_DATABASE));
  await server.markAsTemplate(TEMPLATE_DATABASE);

  project.provide('postgres', {
    url: container.getConnectionUri(),
    templateDatabase: TEMPLATE_DATABASE,
  });

  return async () => {
    await container.stop();
  };
}
