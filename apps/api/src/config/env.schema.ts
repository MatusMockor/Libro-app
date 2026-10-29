import { z } from 'zod';
import { AppVersion } from '../shared/app-version.js';
import { MEDIA_STORAGE_DRIVERS } from './media-storage-driver.js';
import {
  NON_SECRET_JWT_ACCESS_SECRETS,
  NON_SECRET_MEDIA_URL_SIGNING_SECRETS,
} from './non-secret-values.js';
import { parseTrustProxy } from './trust-proxy.js';

const requiredOr = (message: string) => (issue: { input?: unknown }) =>
  issue.input === undefined ? 'is required' : message;

const SECRET_MIN_LENGTH = 32;
const SECRET_ERROR = `must be at least ${String(SECRET_MIN_LENGTH)} characters`;

const secret = z
  .string({ error: requiredOr(SECRET_ERROR) })
  .min(SECRET_MIN_LENGTH, { error: SECRET_ERROR })
  .refine((value) => value.trim() !== '', { error: 'must not be blank' });

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

const commaSeparatedList = z
  .string({ error: 'must be a comma-separated list' })
  .optional()
  .transform((value) => [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== ''),
    ),
  ]);

export const DEFAULT_MEDIA_LOCAL_ROOT = './storage/media';

export const mediaStorageDriverSchema = z
  .enum(MEDIA_STORAGE_DRIVERS, {
    error: `must be one of: ${MEDIA_STORAGE_DRIVERS.join(', ')}`,
  })
  .default('local');

const directoryPath = (fallback: string) =>
  z
    .string({ error: 'must be a directory path' })
    .optional()
    .transform((value) => (value === undefined || value.trim() === '' ? fallback : value.trim()));

const PUBLIC_URL_ERROR = 'must be an absolute http:// or https:// URL without query or fragment';

const publicUrl = (fallback: string) =>
  z
    .url({ protocol: /^https?$/, error: PUBLIC_URL_ERROR })
    .refine((value) => !/[?#]/.test(value), { error: PUBLIC_URL_ERROR })
    .default(fallback)
    .transform((value) => value.replace(/\/+$/, ''));

const NON_SECRET_VALUES = [
  { key: 'JWT_ACCESS_SECRET', values: NON_SECRET_JWT_ACCESS_SECRETS },
  { key: 'MEDIA_URL_SIGNING_SECRET', values: NON_SECRET_MEDIA_URL_SIGNING_SECRETS },
] as const;

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
    JWT_ACCESS_SECRET: secret,
    AUTH_RATE_LIMIT_MAX: positiveInteger(10),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: positiveInteger(60),
    TRUST_PROXY: trustProxy,
    GOOGLE_CLIENT_IDS: commaSeparatedList,
    MEDIA_STORAGE_DRIVER: mediaStorageDriverSchema,
    MEDIA_LOCAL_ROOT: directoryPath(DEFAULT_MEDIA_LOCAL_ROOT),
    MEDIA_URL_SIGNING_SECRET: secret,
    PUBLIC_API_URL: publicUrl('http://localhost:3000'),
    MEDIA_UPLOAD_CONCURRENCY: positiveInteger(4),
  })
  .check((context) => {
    if (context.value.NODE_ENV !== 'production') {
      return;
    }

    for (const { key, values } of NON_SECRET_VALUES) {
      const value = context.value[key];
      if (values.includes(value)) {
        context.issues.push({
          code: 'custom',
          path: [key],
          input: value,
          message: 'must not be the development value in production',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;
