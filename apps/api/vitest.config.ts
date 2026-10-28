import { defineConfig } from 'vitest/config';
import { TEST_JWT_ACCESS_SECRET } from './src/config/non-secret-values.js';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: TEST_JWT_ACCESS_SECRET,
      AUTH_RATE_LIMIT_MAX: '1000',
    },
    globalSetup: ['test/support/global-setup.ts'],
    setupFiles: ['test/support/database-per-file.setup.ts'],
    execArgv: ['--import', '@oxc-node/core/register'],
  },
});
