import {
  MAX_OFFICIAL_ACCOUNTS,
  type OfficialAccountChange,
  type OfficialAccounts,
} from '../modules/profiles/index.js';

export const OFFICIAL_ACCOUNT_USAGE = 'Usage: pnpm profiles:set-official <handle> [--revoke]';

const REVOKE_FLAG = '--revoke';

export interface OfficialAccountCommand {
  readonly handle: string;
  readonly revoke: boolean;
}

export interface CommandResult {
  readonly exitCode: number;
  readonly message: string;
}

export function parseOfficialAccountCommand(
  args: readonly string[],
): OfficialAccountCommand | undefined {
  const handles = args.filter((arg) => arg !== REVOKE_FLAG);
  const [handle] = handles;
  if (handles.length !== 1 || handle === undefined || handle.startsWith('-')) {
    return undefined;
  }

  return { handle: handle.replace(/^@/, ''), revoke: args.includes(REVOKE_FLAG) };
}

export async function runOfficialAccountCommand(
  accounts: OfficialAccounts,
  { handle, revoke }: OfficialAccountCommand,
): Promise<CommandResult> {
  const change = revoke ? await accounts.revoke(handle) : await accounts.grant(handle);

  return resultOf(change, `@${handle}`, revoke);
}

function resultOf(change: OfficialAccountChange, handle: string, revoke: boolean): CommandResult {
  const messages: Readonly<Record<OfficialAccountChange, string>> = {
    changed: revoke
      ? `${handle} is no longer an official Libro account`
      : `${handle} is an official Libro account now`,
    unchanged: revoke
      ? `${handle} was not an official Libro account; nothing changed`
      : `${handle} already is an official Libro account; nothing changed`,
    profile_not_found: `No profile has the handle ${handle}`,
    limit_reached: `At most ${String(MAX_OFFICIAL_ACCOUNTS)} official accounts are allowed; revoke one first`,
  };
  const failed = change === 'profile_not_found' || change === 'limit_reached';

  return { exitCode: failed ? 1 : 0, message: messages[change] };
}
