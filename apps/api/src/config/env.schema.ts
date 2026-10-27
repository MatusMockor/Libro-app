import { z } from 'zod';
import { AppVersion } from '../shared/app-version.js';

const requiredOr = (message: string) => (issue: { input?: unknown }) =>
  issue.input === undefined ? 'is required' : message;

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

export const envSchema = z.object({
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
});

export type Env = z.infer<typeof envSchema>;
