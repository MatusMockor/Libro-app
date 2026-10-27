import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configModuleOptions } from '../src/config/config-module.options.js';
import { envFilePaths } from '../src/config/env-file-paths.js';
import { envSchema } from '../src/config/env.schema.js';

describe('config validation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('refuses to start with an invalid environment and names every broken variable', async () => {
    vi.stubEnv('NODE_ENV', 'staging');
    vi.stubEnv('PORT', 'not-a-port');
    vi.stubEnv('DATABASE_URL', 'mysql://root@localhost/libro');

    const loading = ConfigModule.forRoot(configModuleOptions([]));

    await expect(loading).rejects.toThrow(
      [
        'Config validation error: NODE_ENV: must be one of: development, test, production',
        'PORT: must be a number',
        'DATABASE_URL: must be a postgres:// or postgresql:// connection URL',
      ].join('\n'),
    );
  });

  it('reports a missing DATABASE_URL as required', async () => {
    vi.stubEnv('DATABASE_URL', undefined);

    await expect(ConfigModule.forRoot(configModuleOptions([]))).rejects.toThrow(
      'Config validation error: DATABASE_URL: is required',
    );
  });

  it('rejects a port outside the valid range', () => {
    const result = envSchema.safeParse({
      PORT: '70000',
      DATABASE_URL: 'postgres://libro_app@127.0.0.1:5433/libro_app',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'must be between 1 and 65535',
    ]);
  });

  it('applies defaults for optional variables', () => {
    const env = envSchema.parse({
      DATABASE_URL: 'postgresql://libro_app@127.0.0.1:5433/libro_app',
    });

    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: 'postgresql://libro_app@127.0.0.1:5433/libro_app',
    });
  });
});

describe('env files', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'libro-env-'));
    vi.stubEnv('LIBRO_ENV_PROBE', undefined);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  });

  it('lets .env.local override .env outside of tests', async () => {
    await writeFile(join(directory, '.env'), 'LIBRO_ENV_PROBE=from-env\n');
    await writeFile(join(directory, '.env.local'), 'LIBRO_ENV_PROBE=from-env-local\n');

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(configModuleOptions(envFilePaths('development', directory)))],
    }).compile();

    expect(moduleRef.get(ConfigService).get<string>('LIBRO_ENV_PROBE')).toBe('from-env-local');
  });

  it('loads only .env.test in the test environment', async () => {
    await writeFile(join(directory, '.env'), 'LIBRO_ENV_PROBE=from-env\n');
    await writeFile(join(directory, '.env.local'), 'LIBRO_ENV_PROBE=from-env-local\n');
    await writeFile(join(directory, '.env.test'), 'LIBRO_ENV_PROBE=from-env-test\n');

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(configModuleOptions(envFilePaths('test', directory)))],
    }).compile();

    expect(moduleRef.get(ConfigService).get<string>('LIBRO_ENV_PROBE')).toBe('from-env-test');
  });
});
