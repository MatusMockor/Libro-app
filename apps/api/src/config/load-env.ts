import { existsSync } from 'node:fs';
import { z } from 'zod';
import { envSchema, type Env } from './env.schema.js';

export function loadEnv(envFiles: string[]): Env {
  envFiles
    .filter((file) => existsSync(file))
    .forEach((file) => {
      process.loadEnvFile(file);
    });

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Config validation error:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}
