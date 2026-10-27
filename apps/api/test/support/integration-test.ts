import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { test as base } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { truncateAllTables } from './truncate-tables.js';

async function createApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  return configureApp(moduleRef.createNestApplication<INestApplication<App>>()).init();
}

export const test = base
  .extend('app', { scope: 'file' }, async ({}, { onCleanup }) => {
    const app = await createApp();
    onCleanup(() => app.close());

    return app;
  })
  .extend('http', { scope: 'file' }, ({ app }) => request(app.getHttpServer()))
  .extend('dataSource', { scope: 'file' }, ({ app }) => app.get(DataSource))
  .extend('emptyDatabase', { auto: true }, async ({ dataSource }) => {
    await truncateAllTables(dataSource);
  });
