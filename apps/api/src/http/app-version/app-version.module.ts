import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { APP_VERSION_POLICY } from './app-version-policy.js';
import { APP_VERSION_USAGE } from './app-version-usage.js';
import { AppVersionGuard } from './app-version.guard.js';
import { ConfigAppVersionPolicy } from './config-app-version.policy.js';
import { LoggerAppVersionUsage } from './logger-app-version.usage.js';

@Module({
  providers: [
    { provide: APP_VERSION_POLICY, useClass: ConfigAppVersionPolicy },
    { provide: APP_VERSION_USAGE, useClass: LoggerAppVersionUsage },
    { provide: APP_GUARD, useClass: AppVersionGuard },
  ],
})
export class AppVersionModule {}
