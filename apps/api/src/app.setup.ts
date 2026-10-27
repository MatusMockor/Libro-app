import { VersioningType, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './config/env.schema.js';
import { setupOpenApi } from './http/openapi/setup-openapi.js';

export function configureApp<T extends INestApplication>(app: T): T {
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  if (isOpenApiEnabled(app.get<ConfigService<Env, true>>(ConfigService))) {
    setupOpenApi(app);
  }

  return app;
}

function isOpenApiEnabled(config: ConfigService<Env, true>): boolean {
  return config.get('NODE_ENV', { infer: true }) !== 'production';
}
