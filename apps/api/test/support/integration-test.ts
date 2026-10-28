import type { INestApplication, ModuleMetadata } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { test as base } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { seederFactories } from './seeder-factories.js';
import { signInWith } from './sign-in.js';
import { truncateAllTables } from './truncate-tables.js';

type Imports = NonNullable<ModuleMetadata['imports']>;
type Configure = (builder: TestingModuleBuilder) => TestingModuleBuilder;

export interface IntegrationTestOptions {
  imports?: Imports;
  configure?: Configure;
}

async function createApp(imports: Imports, configure: Configure): Promise<INestApplication<App>> {
  const moduleRef = await configure(
    Test.createTestingModule({ imports: [AppModule, ...imports] }),
  ).compile();

  return configureApp(moduleRef.createNestApplication<INestApplication<App>>()).init();
}

export function integrationTest({
  imports = [],
  configure = (builder) => builder,
}: IntegrationTestOptions = {}) {
  return base
    .extend('app', { scope: 'file' }, async ({}, { onCleanup }) => {
      const app = await createApp(imports, configure);
      onCleanup(() => app.close());

      return app;
    })
    .extend('http', { scope: 'file' }, ({ app }) => request(app.getHttpServer()))
    .extend('dataSource', { scope: 'file' }, ({ app }) => app.get(DataSource))
    .extend('factories', ({ dataSource }) => seederFactories(dataSource))
    .extend('emptyDatabase', { auto: true }, async ({ dataSource }) => {
      await truncateAllTables(dataSource);
    })
    .extend('signIn', ({ app, factories }) => signInWith(app, factories));
}

export const test = integrationTest();
