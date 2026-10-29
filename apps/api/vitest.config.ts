import { defineConfig } from 'vitest/config';
import { TEST_JWT_ACCESS_SECRET } from './src/config/non-secret-values.js';
import { TEST_GOOGLE_CLIENT_IDS } from './test/support/google-client-ids.js';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: TEST_JWT_ACCESS_SECRET,
      AUTH_RATE_LIMIT_MAX: '1000',
      GOOGLE_CLIENT_IDS: TEST_GOOGLE_CLIENT_IDS.join(','),
    },
    globalSetup: ['test/support/global-setup.ts'],
    setupFiles: ['test/support/database-per-file.setup.ts'],
    execArgv: ['--import', '@oxc-node/core/register'],
  },
});
