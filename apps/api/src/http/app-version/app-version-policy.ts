import type { AppClient } from './app-client.js';
import type { AppPlatform } from './app-platform.js';
import type { AppVersion } from '../../shared/app-version.js';

export const APP_VERSION_POLICY = Symbol('APP_VERSION_POLICY');

export interface AppVersionPolicy {
  minimumVersion(platform: AppPlatform): AppVersion;
  isSupported(client: AppClient): boolean;
}
