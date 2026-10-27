import { z } from 'zod';

const requiredOr = (message: string) => (issue: { input?: unknown }) =>
  issue.input === undefined ? 'is required' : message;

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
});

export type Env = z.infer<typeof envSchema>;
