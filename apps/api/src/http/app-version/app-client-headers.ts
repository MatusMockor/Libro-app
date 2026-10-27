import type { IncomingHttpHeaders } from 'node:http';
import type { AppClient } from './app-client.js';
import { APP_PLATFORMS, parseAppPlatform } from './app-platform.js';
import { AppVersion } from '../../shared/app-version.js';

export const APP_VERSION_HEADER = 'X-App-Version';
export const PLATFORM_HEADER = 'X-Platform';

export type AppClientIdentity =
  | { readonly kind: 'anonymous' }
  | { readonly kind: 'app'; readonly client: AppClient }
  | { readonly kind: 'invalid'; readonly reason: string };

const ANONYMOUS: AppClientIdentity = { kind: 'anonymous' };

export function identifyAppClient(headers: IncomingHttpHeaders): AppClientIdentity {
  const platformValue = headerValue(headers, PLATFORM_HEADER);
  const versionValue = headerValue(headers, APP_VERSION_HEADER);

  if (platformValue === undefined && versionValue === undefined) {
    return ANONYMOUS;
  }

  if (platformValue === undefined) {
    return invalid(`The ${PLATFORM_HEADER} header is required with ${APP_VERSION_HEADER}.`);
  }

  if (versionValue === undefined) {
    return invalid(`The ${APP_VERSION_HEADER} header is required with ${PLATFORM_HEADER}.`);
  }

  return parseClient(platformValue, versionValue);
}

function parseClient(platformValue: string, versionValue: string): AppClientIdentity {
  const platform = parseAppPlatform(platformValue);
  if (!platform) {
    return invalid(`${PLATFORM_HEADER} must be one of: ${APP_PLATFORMS.join(', ')}.`);
  }

  const version = AppVersion.parse(versionValue);
  if (!version) {
    return invalid(`${APP_VERSION_HEADER} must be a version like 1.4.0.`);
  }

  return { kind: 'app', client: { platform, version } };
}

function headerValue(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name.toLowerCase()];

  return Array.isArray(value) ? value.join(', ') : value;
}

function invalid(reason: string): AppClientIdentity {
  return { kind: 'invalid', reason };
}
