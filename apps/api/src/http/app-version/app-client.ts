import type { AppPlatform } from './app-platform.js';
import type { AppVersion } from '../../shared/app-version.js';

export interface AppClient {
  readonly platform: AppPlatform;
  readonly version: AppVersion;
}
