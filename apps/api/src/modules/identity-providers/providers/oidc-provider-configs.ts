import type { ConfigService } from '@nestjs/config';
import type { JWTVerifyGetKey } from 'jose';
import type { Env } from '../../../config/env.schema.js';
import type { OidcProviderConfig } from '../security/oidc-provider-config.js';
import { googleProviderConfig } from './google.provider.js';

export function oidcProviderConfigs(
  config: ConfigService<Env, true>,
  googleSigningKeys: JWTVerifyGetKey,
): OidcProviderConfig[] {
  return [googleProviderConfig(config, googleSigningKeys)];
}
