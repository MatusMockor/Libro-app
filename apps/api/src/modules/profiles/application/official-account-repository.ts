import type { OfficialAccountChange } from '../domain/official-account.js';

export const OFFICIAL_ACCOUNT_REPOSITORY = Symbol('OFFICIAL_ACCOUNT_REPOSITORY');

export interface OfficialAccountRepository {
  setOfficial(handle: string, official: boolean, limit: number): Promise<OfficialAccountChange>;
  officialUserIds(limit: number): Promise<string[]>;
}
