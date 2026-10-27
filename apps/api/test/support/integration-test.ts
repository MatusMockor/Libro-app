import type { INestApplication, ModuleMetadata } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { test as base } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { truncateAllTables } from './truncate-tables.js';

type Imports = NonNullable<ModuleMetadata['imports']>;

export interface IntegrationTestOptions {
  imports?: Imports;
}

async function createApp(imports: Imports): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule, ...imports] }).compile();

  return configureApp(moduleRef.createNestApplication<INestApplication<App>>()).init();
}

export function integrationTest({ imports = [] }: IntegrationTestOptions = {}) {
  return base
    .extend('app', { scope: 'file' }, async ({}, { onCleanup }) => {
      const app = await createApp(imports);
      onCleanup(() => app.close());

      return app;
    })
    .extend('http', { scope: 'file' }, ({ app }) => request(app.getHttpServer()))
    .extend('dataSource', { scope: 'file' }, ({ app }) => app.get(DataSource))
    .extend('emptyDatabase', { auto: true }, async ({ dataSource }) => {
      await truncateAllTables(dataSource);
    });
}

export const test = integrationTest();
