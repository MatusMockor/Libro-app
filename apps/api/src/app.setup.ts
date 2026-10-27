import { VersioningType, type INestApplication } from '@nestjs/common';

export function configureApp<T extends INestApplication>(app: T): T {
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  return app;
}
