import type { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';
import type { Env } from '../../../config/env.schema.js';
import type { OidcProviderConfig } from '../security/oidc-provider-config.js';

export const GOOGLE_SIGNING_KEYS = Symbol('GOOGLE_SIGNING_KEYS');

export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

export const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

export function googleSigningKeys(): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
}

export function googleProviderConfig(
  config: ConfigService<Env, true>,
  signingKeys: JWTVerifyGetKey,
): OidcProviderConfig {
  return {
    provider: 'google',
    issuers: GOOGLE_ISSUERS,
    clientIds: config.get('GOOGLE_CLIENT_IDS', { infer: true }),
    signingKeys,
  };
}
