import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configModuleOptions } from './config/config-module.options.js';
import { envFilePaths, WORKSPACE_ROOT } from './config/env-file-paths.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { AppVersionModule } from './http/app-version/app-version.module.js';
import { HttpApiModule } from './http/http-api.module.js';

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions(envFilePaths(process.env.NODE_ENV, WORKSPACE_ROOT))),
    DatabaseModule,
    HttpApiModule,
    AppVersionModule,
    HealthModule,
  ],
})
export class AppModule {}
