import type { DataSource } from 'typeorm';
import { verify } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import cliDataSource from '../src/database/data-source.js';

const EXTENSIONS = ['pg_trgm', 'postgis', 'unaccent', 'vector'];
const MODULE_TABLES = [
  'auth.identities',
  'auth.refresh_tokens',
  'auth.sessions',
  'auth.sign_in_nonces',
  'auth.users',
  'books.authors',
  'books.editions',
  'books.work_authors',
  'books.works',
  'media.file_variants',
  'media.files',
  'reading.checkpoints',
  'reading.marked_parts',
  'reading.readings',
  'reading.sessions',
  'tree.finished_trees',
];
const MODULE_SCHEMAS = ['auth', 'books', 'media', 'reading', 'tree'];

async function installedExtensions(dataSource: DataSource): Promise<string[]> {
  const rows: { extname: string }[] = await dataSource.query(
    'SELECT extname FROM pg_extension WHERE extname = ANY($1) ORDER BY extname',
    [EXTENSIONS],
  );

  return rows.map((row) => row.extname);
}

async function moduleTables(dataSource: DataSource): Promise<string[]> {
  const rows: { name: string }[] = await dataSource.query(
    `SELECT table_schema || '.' || table_name AS name
     FROM information_schema.tables
     WHERE table_schema = ANY($1)
     ORDER BY name`,
    [MODULE_SCHEMAS],
  );

  return rows.map((row) => row.name);
}

async function schemaExists(dataSource: DataSource, schema: string): Promise<boolean> {
  const rows: unknown[] = await dataSource.query(
    'SELECT 1 FROM information_schema.schemata WHERE schema_name = $1',
    [schema],
  );

  return rows.length > 0;
}

interface StoredPassword {
  email: string;
  passwordHash: string | null;
}

const GOOGLE_ONLY_USERS = 9;

const PASSWORD_USERS = [
  { email: 'password-a@example.test', passwordHash: 'a-password-hash' },
  { email: 'password-z@example.test', passwordHash: 'z-password-hash' },
];

async function arrangePasswordAndGoogleOnlyUsers(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    `INSERT INTO auth.users (email, password_hash)
     SELECT email, password_hash FROM unnest($1::text[], $2::text[]) AS users (email, password_hash)`,
    [
      PASSWORD_USERS.map(({ email }) => email),
      PASSWORD_USERS.map(({ passwordHash }) => passwordHash),
    ],
  );
  await dataSource.query(
    `INSERT INTO auth.users (email, password_hash)
     SELECT 'google-only-' || n || '@example.test', NULL FROM generate_series(1, $1::int) AS n`,
    [GOOGLE_ONLY_USERS],
  );
  await dataSource.query(
    `INSERT INTO auth.identities (provider, subject, user_id)
     SELECT 'google', 'subject-' || email, id FROM auth.users WHERE email LIKE 'google-only-%'`,
  );
}

function storedPasswords(dataSource: DataSource): Promise<StoredPassword[]> {
  return dataSource.query<StoredPassword[]>(
    'SELECT email, password_hash AS "passwordHash" FROM auth.users ORDER BY email',
  );
}

async function tableExists(dataSource: DataSource, table: string): Promise<boolean> {
  const [row] = await dataSource.query<{ exists: boolean }[]>(
    'SELECT to_regclass($1) IS NOT NULL AS exists',
    [table],
  );

  return row?.exists === true;
}

async function revertUntilTableIsGone(dataSource: DataSource, table: string): Promise<void> {
  for (let step = 0; step < dataSource.migrations.length; step += 1) {
    if (!(await tableExists(dataSource, table))) {
      return;
    }

    await dataSource.undoLastMigration();
  }
}

async function passwordHashIsNullable(dataSource: DataSource): Promise<boolean> {
  const [column] = await dataSource.query<{ nullable: boolean }[]>(
    `SELECT is_nullable = 'YES' AS nullable
     FROM information_schema.columns
     WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'password_hash'`,
  );

  return column?.nullable === true;
}

async function revertAllMigrations(dataSource: DataSource): Promise<void> {
  for (let step = 0; step < dataSource.migrations.length; step += 1) {
    await dataSource.undoLastMigration();
  }
}

describe('database migrations', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await cliDataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('enables the required extensions', async () => {
    await dataSource.runMigrations();

    expect(await installedExtensions(dataSource)).toEqual(EXTENSIONS);
  });

  it('creates the module schemas with their tables', async () => {
    await dataSource.runMigrations();

    expect(await moduleTables(dataSource)).toEqual(MODULE_TABLES);
  });

  it('keeps Google-only users with an unusable password when the identities migration is reverted', async () => {
    await dataSource.runMigrations();
    await arrangePasswordAndGoogleOnlyUsers(dataSource);
    onTestFinished(async () => {
      await dataSource.runMigrations();
      await dataSource.query('DELETE FROM auth.users');
    });

    await revertUntilTableIsGone(dataSource, 'auth.identities');
    const stored = await storedPasswords(dataSource);
    const googleOnly = stored.filter(({ email }) => email.startsWith('google-only-'));
    const googleOnlyHashes = googleOnly.map(({ passwordHash }) => passwordHash ?? '');

    expect(await tableExists(dataSource, 'auth.identities')).toBe(false);
    expect(await passwordHashIsNullable(dataSource)).toBe(false);
    expect(stored.filter(({ email }) => email.startsWith('password-'))).toStrictEqual(
      PASSWORD_USERS,
    );
    expect(googleOnly).toHaveLength(GOOGLE_ONLY_USERS);
    expect(new Set(googleOnlyHashes).size).toBe(GOOGLE_ONLY_USERS);
    for (const passwordHash of googleOnlyHashes) {
      expect(passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      expect(await verify(passwordHash, '')).toBe(false);
    }

    await dataSource.runMigrations();
    expect(await moduleTables(dataSource)).toEqual(MODULE_TABLES);
  });

  it('removes the extensions and module schemas when every migration is reverted', async () => {
    await dataSource.runMigrations();
    await revertAllMigrations(dataSource);

    expect(await installedExtensions(dataSource)).toEqual([]);
    for (const schema of MODULE_SCHEMAS) {
      expect(await schemaExists(dataSource, schema)).toBe(false);
    }
    expect(await dataSource.showMigrations()).toBe(true);
  });

  it('re-applies every migration after a full revert', async () => {
    await revertAllMigrations(dataSource);
    await dataSource.runMigrations();

    expect(await installedExtensions(dataSource)).toEqual(EXTENSIONS);
    expect(await moduleTables(dataSource)).toEqual(MODULE_TABLES);
    expect(await dataSource.showMigrations()).toBe(false);
  });
});
