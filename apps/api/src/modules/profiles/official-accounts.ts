import type { OfficialAccountChange } from './domain/official-account.js';

export const OFFICIAL_ACCOUNTS = Symbol('OFFICIAL_ACCOUNTS');

export interface OfficialAccounts {
  grant(handle: string): Promise<OfficialAccountChange>;
  revoke(handle: string): Promise<OfficialAccountChange>;
}
