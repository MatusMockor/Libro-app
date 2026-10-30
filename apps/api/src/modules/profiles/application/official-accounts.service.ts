import { Inject, Injectable } from '@nestjs/common';
import { normaliseHandle } from '../domain/handle.js';
import { MAX_OFFICIAL_ACCOUNTS, type OfficialAccountChange } from '../domain/official-account.js';
import type { OfficialAccounts } from '../official-accounts.js';
import {
  OFFICIAL_ACCOUNT_REPOSITORY,
  type OfficialAccountRepository,
} from './official-account-repository.js';

@Injectable()
export class OfficialAccountsService implements OfficialAccounts {
  constructor(
    @Inject(OFFICIAL_ACCOUNT_REPOSITORY) private readonly accounts: OfficialAccountRepository,
  ) {}

  grant(handle: string): Promise<OfficialAccountChange> {
    return this.accounts.setOfficial(normaliseHandle(handle), true, MAX_OFFICIAL_ACCOUNTS);
  }

  revoke(handle: string): Promise<OfficialAccountChange> {
    return this.accounts.setOfficial(normaliseHandle(handle), false, MAX_OFFICIAL_ACCOUNTS);
  }

  officialUserIds(): Promise<string[]> {
    return this.accounts.officialUserIds(MAX_OFFICIAL_ACCOUNTS);
  }
}
