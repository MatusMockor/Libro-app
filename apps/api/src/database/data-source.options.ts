import { resolve } from 'node:path';
import type { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions.js';
import type { SeederOptions } from 'typeorm-extension';

const SOURCE_ROOT = resolve(import.meta.dirname, '..');
const CONNECTION_TIMEOUT_MS = 5_000;

const sourceFiles = (pattern: string): string => `${SOURCE_ROOT}/${pattern}.{ts,js}`;

export function dataSourceOptions(url: string): PostgresDataSourceOptions {
  return {
    type: 'postgres',
    url,
    synchronize: false,
    installExtensions: false,
    uuidExtension: 'pgcrypto',
    extra: { connectionTimeoutMillis: CONNECTION_TIMEOUT_MS },
    migrations: [sourceFiles('**/migrations/*')],
  };
}

export function cliDataSourceOptions(url: string): PostgresDataSourceOptions & SeederOptions {
  return {
    ...dataSourceOptions(url),
    entities: [sourceFiles('**/*.entity')],
    seeds: [sourceFiles('**/seeds/*.seeder')],
    factories: [sourceFiles('**/factories/*.factory')],
  };
}
