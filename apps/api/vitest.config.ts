import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

const TEST_ENV_DEFAULTS = {
  PORT: '3000',
  DATABASE_URL: 'postgres://libro_app:libro_app@127.0.0.1:5433/libro_app_test',
};

const testEnvFile = resolve(import.meta.dirname, '../../.env.test');
const testEnvOverrides = existsSync(testEnvFile) ? parseEnv(readFileSync(testEnvFile, 'utf8')) : {};

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    env: { ...TEST_ENV_DEFAULTS, ...testEnvOverrides, NODE_ENV: 'test' },
  },
});
