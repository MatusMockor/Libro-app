import type { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import type { Env } from '../../../config/env.schema.js';

const MILLISECONDS_PER_SECOND = 1_000;

export function rateLimitOptions(config: ConfigService<Env, true>): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        limit: config.get('AUTH_RATE_LIMIT_MAX', { infer: true }),
        ttl:
          config.get('AUTH_RATE_LIMIT_WINDOW_SECONDS', { infer: true }) * MILLISECONDS_PER_SECOND,
      },
    ],
    errorMessage: 'Too many attempts. Try again later.',
  };
}
