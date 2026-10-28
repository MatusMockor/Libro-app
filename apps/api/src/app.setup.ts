import { VersioningType, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { Env } from './config/env.schema.js';
import { setupOpenApi } from './http/openapi/setup-openapi.js';

export function configureApp<T extends INestApplication>(app: T): T {
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  trustConfiguredProxies(app, config);

  if (isOpenApiEnabled(config)) {
    setupOpenApi(app);
  }

  return app;
}

function trustConfiguredProxies(app: INestApplication, config: ConfigService<Env, true>): void {
  const trustProxy = config.get('TRUST_PROXY', { infer: true });
  if (trustProxy === 0) {
    return;
  }

  const adapter = app.getHttpAdapter();
  if (!(adapter instanceof ExpressAdapter)) {
    throw new Error('TRUST_PROXY needs the Express HTTP adapter.');
  }

  adapter.set('trust proxy', trustProxy);
}

function isOpenApiEnabled(config: ConfigService<Env, true>): boolean {
  return config.get('NODE_ENV', { infer: true }) !== 'production';
}
