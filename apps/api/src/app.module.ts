import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configModuleOptions } from './config/config-module.options.js';
import { envFilePaths, WORKSPACE_ROOT } from './config/env-file-paths.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions(envFilePaths(process.env.NODE_ENV, WORKSPACE_ROOT))),
    HealthModule,
  ],
})
export class AppModule {}
