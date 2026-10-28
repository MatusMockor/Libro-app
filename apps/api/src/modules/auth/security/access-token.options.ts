import type { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions } from '@nestjs/jwt';
import type { Env } from '../../../config/env.schema.js';

export const ACCESS_TOKEN_ALGORITHM = 'HS256';
export const ACCESS_TOKEN_ISSUER_CLAIM = 'libro-api';
export const ACCESS_TOKEN_AUDIENCE = 'libro-app';
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export function accessTokenOptions(config: ConfigService<Env, true>): JwtModuleOptions {
  return {
    secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
    signOptions: {
      algorithm: ACCESS_TOKEN_ALGORITHM,
      issuer: ACCESS_TOKEN_ISSUER_CLAIM,
      audience: ACCESS_TOKEN_AUDIENCE,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    },
    verifyOptions: {
      algorithms: [ACCESS_TOKEN_ALGORITHM],
      issuer: ACCESS_TOKEN_ISSUER_CLAIM,
      audience: ACCESS_TOKEN_AUDIENCE,
    },
  };
}
