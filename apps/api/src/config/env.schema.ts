import { z } from 'zod';
import { AppVersion } from '../shared/app-version.js';
import { NON_SECRET_JWT_ACCESS_SECRETS } from './non-secret-values.js';
import { parseTrustProxy } from './trust-proxy.js';

const requiredOr = (message: string) => (issue: { input?: unknown }) =>
  issue.input === undefined ? 'is required' : message;

const JWT_SECRET_MIN_LENGTH = 32;
const JWT_SECRET_ERROR = `must be at least ${String(JWT_SECRET_MIN_LENGTH)} characters`;

const positiveInteger = (fallback: number) =>
  z.coerce
    .number({ error: 'must be a number' })
    .int({ error: 'must be an integer' })
    .min(1, { error: 'must be at least 1' })
    .default(fallback);

const TRUST_PROXY_ERROR =
  'must be a hop count or a comma-separated list of IP addresses, CIDR ranges, loopback, linklocal or uniquelocal';

const trustProxy = z
  .string({ error: TRUST_PROXY_ERROR })
  .optional()
  .transform((value, context) => {
    if (value === undefined || value.trim() === '') {
      return 0;
    }

    const trusted = parseTrustProxy(value.trim());
    if (trusted === undefined) {
      context.issues.push({ code: 'custom', input: value, message: TRUST_PROXY_ERROR });
      return z.NEVER;
    }

    return trusted;
  });

const APP_VERSION_ERROR = 'must be a version like 1.4.0';

const appVersion = z
  .string({ error: APP_VERSION_ERROR })
  .default('0.0.0')
  .transform((value, context) => {
    const version = AppVersion.parse(value);
    if (!version) {
      context.issues.push({ code: 'custom', input: value, message: APP_VERSION_ERROR });
      return z.NEVER;
    }

    return version;
  });

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'], {
        error: 'must be one of: development, test, production',
      })
      .default('development'),
    PORT: z.coerce
      .number({ error: 'must be a number' })
      .int({ error: 'must be an integer' })
      .min(1, { error: 'must be between 1 and 65535' })
      .max(65535, { error: 'must be between 1 and 65535' })
      .default(3000),
    DATABASE_URL: z.url({
      protocol: /^postgres(ql)?$/,
      error: requiredOr('must be a postgres:// or postgresql:// connection URL'),
    }),
    MIN_APP_VERSION_IOS: appVersion,
    MIN_APP_VERSION_ANDROID: appVersion,
    JWT_ACCESS_SECRET: z
      .string({ error: requiredOr(JWT_SECRET_ERROR) })
      .min(JWT_SECRET_MIN_LENGTH, { error: JWT_SECRET_ERROR })
      .refine((secret) => secret.trim() !== '', { error: 'must not be blank' }),
    AUTH_RATE_LIMIT_MAX: positiveInteger(10),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: positiveInteger(60),
    TRUST_PROXY: trustProxy,
  })
  .check((context) => {
    const { NODE_ENV, JWT_ACCESS_SECRET } = context.value;

    if (NODE_ENV === 'production' && NON_SECRET_JWT_ACCESS_SECRETS.includes(JWT_ACCESS_SECRET)) {
      context.issues.push({
        code: 'custom',
        path: ['JWT_ACCESS_SECRET'],
        input: JWT_ACCESS_SECRET,
        message: 'must not be the development value in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
