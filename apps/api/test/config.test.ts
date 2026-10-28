import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configModuleOptions } from '../src/config/config-module.options.js';
import { envFilePaths, WORKSPACE_ROOT } from '../src/config/env-file-paths.js';
import { envSchema, type Env } from '../src/config/env.schema.js';
import { loadEnv } from '../src/config/load-env.js';
import {
  LOCAL_DEV_JWT_ACCESS_SECRET,
  NON_SECRET_JWT_ACCESS_SECRETS,
  TEST_JWT_ACCESS_SECRET,
} from '../src/config/non-secret-values.js';
import { AppVersion } from '../src/shared/app-version.js';

const DATABASE_URL = 'postgresql://libro_app@127.0.0.1:5433/libro_app';
const JWT_ACCESS_SECRET = 'a-config-test-secret-of-at-least-32-chars';
const REQUIRED_ENV = { DATABASE_URL, JWT_ACCESS_SECRET };

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
    const result = envSchema.safeParse({ ...REQUIRED_ENV, PORT: '70000' });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'must be between 1 and 65535',
    ]);
  });

  it('refuses to start with a minimum app version that is not MAJOR.MINOR.PATCH', async () => {
    vi.stubEnv('MIN_APP_VERSION_IOS', 'v1.4.0');
    vi.stubEnv('MIN_APP_VERSION_ANDROID', '1.4');

    await expect(ConfigModule.forRoot(configModuleOptions([]))).rejects.toThrow(
      [
        'Config validation error: MIN_APP_VERSION_IOS: must be a version like 1.4.0',
        'MIN_APP_VERSION_ANDROID: must be a version like 1.4.0',
      ].join('\n'),
    );
  });

  it('parses the minimum app versions', () => {
    const env = envSchema.parse({
      ...REQUIRED_ENV,
      MIN_APP_VERSION_IOS: '2.1.0',
      MIN_APP_VERSION_ANDROID: '1.10.3',
    });

    expect(env.MIN_APP_VERSION_IOS.toString()).toBe('2.1.0');
    expect(env.MIN_APP_VERSION_ANDROID.toString()).toBe('1.10.3');
  });

  it('refuses to start without a JWT_ACCESS_SECRET', async () => {
    vi.stubEnv('JWT_ACCESS_SECRET', undefined);

    await expect(ConfigModule.forRoot(configModuleOptions([]))).rejects.toThrow(
      'Config validation error: JWT_ACCESS_SECRET: is required',
    );
  });

  it('refuses a JWT_ACCESS_SECRET shorter than 32 characters', () => {
    const result = envSchema.safeParse({ ...REQUIRED_ENV, JWT_ACCESS_SECRET: 'x'.repeat(31) });

    expect(result.error?.issues.map(({ path, message }) => ({ path, message }))).toEqual([
      { path: ['JWT_ACCESS_SECRET'], message: 'must be at least 32 characters' },
    ]);
  });

  it('refuses a whitespace-only JWT_ACCESS_SECRET', () => {
    const result = envSchema.safeParse({ ...REQUIRED_ENV, JWT_ACCESS_SECRET: ' '.repeat(40) });

    expect(result.error?.issues.map(({ path, message }) => ({ path, message }))).toEqual([
      { path: ['JWT_ACCESS_SECRET'], message: 'must not be blank' },
    ]);
  });

  it.for([
    { name: 'the local development secret', secret: LOCAL_DEV_JWT_ACCESS_SECRET },
    { name: 'the test secret', secret: TEST_JWT_ACCESS_SECRET },
  ])('refuses to start in production with $name', async ({ secret }) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_ACCESS_SECRET', secret);

    await expect(ConfigModule.forRoot(configModuleOptions([]))).rejects.toThrow(
      'Config validation error: JWT_ACCESS_SECRET: must not be the development value in production',
    );
  });

  it('accepts a strong JWT_ACCESS_SECRET in production', () => {
    const result = envSchema.safeParse({
      ...REQUIRED_ENV,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'kq3V9x-production-grade-secret-7Hd2LmZp0Rw',
    });

    expect(result.success).toBe(true);
  });

  it('accepts the local development secret outside production', () => {
    const result = envSchema.safeParse({
      ...REQUIRED_ENV,
      NODE_ENV: 'development',
      JWT_ACCESS_SECRET: LOCAL_DEV_JWT_ACCESS_SECRET,
    });

    expect(result.success).toBe(true);
  });

  it('lists the JWT_ACCESS_SECRET of .env.example as a non-secret value', async () => {
    const example = await readFile(resolve(WORKSPACE_ROOT, '.env.example'), 'utf8');
    const value = /^JWT_ACCESS_SECRET=(.*)$/m.exec(example)?.[1];

    expect(value).toBe(LOCAL_DEV_JWT_ACCESS_SECRET);
    expect(NON_SECRET_JWT_ACCESS_SECRETS).toContain(value);
  });

  it.for([
    { value: '1', trusted: 1 },
    { value: '0', trusted: 0 },
    { value: ' 2 ', trusted: 2 },
    { value: '10.0.0.1', trusted: ['10.0.0.1'] },
    {
      value: 'loopback, 10.0.0.0/8, fd00::/8, 2001:db8::1, uniquelocal,linklocal',
      trusted: ['loopback', '10.0.0.0/8', 'fd00::/8', '2001:db8::1', 'uniquelocal', 'linklocal'],
    },
  ])('parses TRUST_PROXY $value', ({ value, trusted }) => {
    const env = envSchema.parse({ ...REQUIRED_ENV, TRUST_PROXY: value });

    expect(env.TRUST_PROXY).toEqual(trusted);
  });

  it.for(['', '   '])('treats TRUST_PROXY %j as not configured', (value) => {
    const env = envSchema.parse({ ...REQUIRED_ENV, TRUST_PROXY: value });

    expect(env.TRUST_PROXY).toBe(0);
  });

  it('keeps an empty TRUST_PROXY switched off in the config service', async () => {
    vi.stubEnv('TRUST_PROXY', '');

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(configModuleOptions([]))],
    }).compile();

    expect(moduleRef.get<ConfigService<Env, true>>(ConfigService).get('TRUST_PROXY')).toBe(0);
  });

  it.for([
    'true',
    'false',
    '*',
    'all',
    '-1',
    '1.5',
    '10.0.0.0/0',
    '10.0.0.0/33',
    'fd00::/129',
    '10.0.0.1/8/8',
    '10.0.0.256',
    'loopback,',
    'loopback, proxy.example.test',
  ])('refuses TRUST_PROXY %j', (value) => {
    const result = envSchema.safeParse({ ...REQUIRED_ENV, TRUST_PROXY: value });

    expect(result.error?.issues.map(({ path, message }) => ({ path, message }))).toEqual([
      {
        path: ['TRUST_PROXY'],
        message:
          'must be a hop count or a comma-separated list of IP addresses, CIDR ranges, loopback, linklocal or uniquelocal',
      },
    ]);
  });

  it('refuses to start with an unrestricted TRUST_PROXY', async () => {
    vi.stubEnv('TRUST_PROXY', 'true');

    await expect(ConfigModule.forRoot(configModuleOptions([]))).rejects.toThrow(
      'Config validation error: TRUST_PROXY: must be a hop count or a comma-separated list',
    );
  });

  it('refuses a rate limit that is not a positive integer', () => {
    const result = envSchema.safeParse({
      ...REQUIRED_ENV,
      AUTH_RATE_LIMIT_MAX: '0',
      AUTH_RATE_LIMIT_WINDOW_SECONDS: 'a minute',
    });

    expect(result.error?.issues.map(({ path, message }) => ({ path, message }))).toEqual([
      { path: ['AUTH_RATE_LIMIT_MAX'], message: 'must be at least 1' },
      { path: ['AUTH_RATE_LIMIT_WINDOW_SECONDS'], message: 'must be a number' },
    ]);
  });

  it('applies defaults for optional variables', () => {
    const env = envSchema.parse(REQUIRED_ENV);

    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
      MIN_APP_VERSION_IOS: AppVersion.parse('0.0.0'),
      MIN_APP_VERSION_ANDROID: AppVersion.parse('0.0.0'),
      JWT_ACCESS_SECRET,
      AUTH_RATE_LIMIT_MAX: 10,
      AUTH_RATE_LIMIT_WINDOW_SECONDS: 60,
      TRUST_PROXY: 0,
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

describe('loadEnv for the TypeORM CLI', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'libro-load-env-'));
    vi.stubEnv('PORT', undefined);
    vi.stubEnv('LIBRO_ENV_PROBE', undefined);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  });

  it('loads env files with the same precedence as the api', async () => {
    await writeFile(join(directory, '.env'), 'PORT=4001\nLIBRO_ENV_PROBE=from-env\n');
    await writeFile(join(directory, '.env.local'), 'PORT=4002\n');

    const env = loadEnv(envFilePaths('development', directory));

    expect(env.PORT).toBe(4002);
    expect(process.env.LIBRO_ENV_PROBE).toBe('from-env');
  });

  it('keeps real environment variables over env files', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://libro_app@127.0.0.1:5433/from_process');
    await writeFile(
      join(directory, '.env'),
      'DATABASE_URL=postgres://libro_app@127.0.0.1:5433/from_file\n',
    );

    const env = loadEnv(envFilePaths('development', directory));

    expect(env.DATABASE_URL).toBe('postgres://libro_app@127.0.0.1:5433/from_process');
  });

  it('refuses an invalid environment and names every broken variable', () => {
    vi.stubEnv('PORT', 'not-a-port');
    vi.stubEnv('DATABASE_URL', 'mysql://root@localhost/libro');

    expect(() => loadEnv([])).toThrow(
      [
        'Config validation error:',
        '✖ must be a number',
        '  → at PORT',
        '✖ must be a postgres:// or postgresql:// connection URL',
        '  → at DATABASE_URL',
      ].join('\n'),
    );
  });
});
