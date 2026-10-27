import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import type { AppClient } from './app-client.js';
import type { AppPlatform } from './app-platform.js';
import type { AppVersionPolicy } from './app-version-policy.js';
import type { AppVersion } from '../../shared/app-version.js';

@Injectable()
export class ConfigAppVersionPolicy implements AppVersionPolicy {
  private readonly minimums: Readonly<Record<AppPlatform, AppVersion>>;

  constructor(config: ConfigService<Env, true>) {
    this.minimums = {
      ios: config.get('MIN_APP_VERSION_IOS', { infer: true }),
      android: config.get('MIN_APP_VERSION_ANDROID', { infer: true }),
    };
  }

  minimumVersion(platform: AppPlatform): AppVersion {
    return this.minimums[platform];
  }

  isSupported(client: AppClient): boolean {
    return !client.version.isOlderThan(this.minimumVersion(client.platform));
  }
}
