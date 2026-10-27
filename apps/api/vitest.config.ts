import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    env: { NODE_ENV: 'test' },
    globalSetup: ['test/support/global-setup.ts'],
    setupFiles: ['test/support/database-per-file.setup.ts'],
    execArgv: ['--import', '@oxc-node/core/register'],
  },
});
