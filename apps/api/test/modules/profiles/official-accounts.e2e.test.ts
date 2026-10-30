import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect } from 'vitest';
import {
  OFFICIAL_ACCOUNT_USAGE,
  parseOfficialAccountCommand,
  runOfficialAccountCommand,
} from '../../../src/cli/official-account-command.js';
import type { ProfileResponse } from '../../../src/modules/profiles/http/profile.response.js';
import {
  MAX_OFFICIAL_ACCOUNTS,
  OFFICIAL_ACCOUNTS,
  PROFILE_DIRECTORY,
  type OfficialAccounts,
  type ProfileDirectory,
} from '../../../src/modules/profiles/index.js';
import { profileRoute, test as base, type Member } from './profiles.fixture.js';

const API_ROOT = resolve(import.meta.dirname, '../../..');

const CLI_TIMEOUT_MS = 60_000;

const CLI_TEST_TIMEOUT_MS = 120_000;

const execute = promisify(execFile);

interface CommandOutput {
  readonly exitCode: number;
  readonly output: string;
}

async function runCommand(...args: readonly string[]): Promise<CommandOutput> {
  try {
    const { stdout, stderr } = await execute(
      'node',
      ['--import', '@oxc-node/core/register', 'src/cli/set-official-account.ts', ...args],
      { cwd: API_ROOT, env: process.env, timeout: CLI_TIMEOUT_MS },
    );

    return { exitCode: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };

    return {
      exitCode: failed.code ?? -1,
      output: `${failed.stdout ?? ''}${failed.stderr ?? ''}`,
    };
  }
}

async function profileOf(viewer: Member, member: Member): Promise<ProfileResponse> {
  const response = await viewer.get(profileRoute(member.id));
  expect(response.status).toBe(200);

  return response.body as ProfileResponse;
}

const test = base
  .extend('accounts', { scope: 'file' }, ({ app }) => app.get<OfficialAccounts>(OFFICIAL_ACCOUNTS))
  .extend('directory', { scope: 'file' }, ({ app }) =>
    app.get<ProfileDirectory>(PROFILE_DIRECTORY),
  );

describe('OFFICIAL_ACCOUNTS public interface', () => {
  test('grants and revokes the official badge by handle', async ({
    accounts,
    directory,
    member,
    newMember,
  }) => {
    const libro = await newMember({ handle: 'libro.club' });

    const granted = await accounts.grant(' Libro.Club ');
    const asOfficial = await profileOf(member, libro);
    const summaries = await directory.findSummaries(member.id, [libro.id, member.id]);
    const officialIds = await directory.officialUserIds();
    const revoked = await accounts.revoke('libro.club');

    expect(granted).toBe('changed');
    expect(asOfficial.official).toBe(true);
    expect(summaries.get(libro.id)?.official).toBe(true);
    expect(summaries.get(member.id)?.official).toBe(false);
    expect(officialIds).toEqual([libro.id]);
    expect(revoked).toBe('changed');
    expect((await profileOf(member, libro)).official).toBe(false);
    expect(await directory.officialUserIds()).toEqual([]);
  });

  test('changes nothing when the account already has the state', async ({
    accounts,
    newMember,
  }) => {
    await newMember({ handle: 'libro.club' });

    expect(await accounts.revoke('libro.club')).toBe('unchanged');
    expect(await accounts.grant('libro.club')).toBe('changed');
    expect(await accounts.grant('libro.club')).toBe('unchanged');
  });

  test('answers profile_not_found for an unknown handle', async ({ accounts, directory }) => {
    expect(await accounts.grant('nobody.here')).toBe('profile_not_found');
    expect(await accounts.revoke('nobody.here')).toBe('profile_not_found');
    expect(await directory.officialUserIds()).toEqual([]);
  });

  test(`allows at most ${String(MAX_OFFICIAL_ACCOUNTS)} official accounts`, async ({
    accounts,
    directory,
    newMember,
  }) => {
    for (let index = 0; index <= MAX_OFFICIAL_ACCOUNTS; index += 1) {
      await newMember({ handle: `libro.${String(index)}` });
    }
    for (let index = 0; index < MAX_OFFICIAL_ACCOUNTS; index += 1) {
      expect(await accounts.grant(`libro.${String(index)}`)).toBe('changed');
    }

    const overTheCap = await accounts.grant(`libro.${String(MAX_OFFICIAL_ACCOUNTS)}`);
    const afterRevoking = [
      await accounts.revoke('libro.0'),
      await accounts.grant(`libro.${String(MAX_OFFICIAL_ACCOUNTS)}`),
    ];

    expect(overTheCap).toBe('limit_reached');
    expect(afterRevoking).toEqual(['changed', 'changed']);
    expect(await directory.officialUserIds()).toHaveLength(MAX_OFFICIAL_ACCOUNTS);
  });

  test('cannot be set through the profile API', async ({ member }) => {
    const response = await member.updateProfile({ official: true });

    expect(response.status).toBe(200);
    expect((response.body as ProfileResponse).official).toBe(false);
  });
});

describe('profiles:set-official command', () => {
  test.for([
    { args: [], parsed: undefined },
    { args: ['--revoke'], parsed: undefined },
    { args: ['one', 'two'], parsed: undefined },
    { args: ['--force'], parsed: undefined },
    { args: ['libro.club'], parsed: { handle: 'libro.club', revoke: false } },
    { args: ['@libro.club', '--revoke'], parsed: { handle: 'libro.club', revoke: true } },
    { args: ['--revoke', 'libro.club'], parsed: { handle: 'libro.club', revoke: true } },
  ])('parses $args', ({ args, parsed }) => {
    expect(parseOfficialAccountCommand(args)).toEqual(parsed);
  });

  test('reports every outcome with an exit code', async ({ accounts, newMember }) => {
    await newMember({ handle: 'libro.club' });

    const results = [
      await runOfficialAccountCommand(accounts, { handle: 'libro.club', revoke: false }),
      await runOfficialAccountCommand(accounts, { handle: 'libro.club', revoke: false }),
      await runOfficialAccountCommand(accounts, { handle: 'libro.club', revoke: true }),
      await runOfficialAccountCommand(accounts, { handle: 'libro.club', revoke: true }),
      await runOfficialAccountCommand(accounts, { handle: 'nobody.here', revoke: false }),
    ];

    expect(results).toEqual([
      { exitCode: 0, message: '@libro.club is an official Libro account now' },
      { exitCode: 0, message: '@libro.club already is an official Libro account; nothing changed' },
      { exitCode: 0, message: '@libro.club is no longer an official Libro account' },
      { exitCode: 0, message: '@libro.club was not an official Libro account; nothing changed' },
      { exitCode: 1, message: 'No profile has the handle @nobody.here' },
    ]);
  });

  test('reports the cap with exit code 1', async ({ accounts, newMember }) => {
    for (let index = 0; index <= MAX_OFFICIAL_ACCOUNTS; index += 1) {
      await newMember({ handle: `libro.${String(index)}` });
      await accounts.grant(`libro.${String(index)}`);
    }

    expect(
      await runOfficialAccountCommand(accounts, {
        handle: `libro.${String(MAX_OFFICIAL_ACCOUNTS)}`,
        revoke: false,
      }),
    ).toEqual({
      exitCode: 1,
      message: `At most ${String(MAX_OFFICIAL_ACCOUNTS)} official accounts are allowed; revoke one first`,
    });
  });

  test(
    'runs as the profiles:set-official command',
    { timeout: CLI_TEST_TIMEOUT_MS },
    async ({ member, newMember }) => {
      const libro = await newMember({ handle: 'libro.club' });

      const granted = await runCommand('libro.club');
      const asOfficial = await profileOf(member, libro);
      const revoked = await runCommand('libro.club', '--revoke');
      const unknown = await runCommand('nobody.here');
      const usage = await runCommand();

      expect(granted.exitCode).toBe(0);
      expect(granted.output).toContain('@libro.club is an official Libro account now');
      expect(asOfficial.official).toBe(true);
      expect(revoked.exitCode).toBe(0);
      expect(revoked.output).toContain('@libro.club is no longer an official Libro account');
      expect((await profileOf(member, libro)).official).toBe(false);
      expect(unknown.exitCode).toBe(1);
      expect(unknown.output).toContain('No profile has the handle @nobody.here');
      expect(usage.exitCode).toBe(1);
      expect(usage.output).toContain(OFFICIAL_ACCOUNT_USAGE);
    },
  );
});
