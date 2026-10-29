import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../events/event-bus.js';
import type { DeletedAccountsPurge } from '../deleted-accounts-purge.js';
import { DELETED_ACCOUNT_RETENTION_DAYS } from '../domain/account-deletion.js';
import { UserDeleted } from '../events/user-deleted.event.js';
import {
  DELETED_ACCOUNT_REPOSITORY,
  type DeletedAccountRepository,
} from './deleted-account-repository.js';

const DELETED_ACCOUNTS_PER_PAGE = 100;

@Injectable()
export class DeletedAccountsPurgeService implements DeletedAccountsPurge {
  constructor(
    @Inject(DELETED_ACCOUNT_REPOSITORY) private readonly deletedAccounts: DeletedAccountRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async replayAll(): Promise<number> {
    let replayed = 0;
    let afterUserId: string | undefined;

    for (;;) {
      const userIds = await this.deletedAccounts.userIds({
        afterUserId,
        limit: DELETED_ACCOUNTS_PER_PAGE,
      });
      for (const userId of userIds) {
        await this.events.publish(UserDeleted.create({ userId }));
      }

      replayed += userIds.length;
      afterUserId = userIds.at(-1);
      if (userIds.length < DELETED_ACCOUNTS_PER_PAGE) {
        return replayed;
      }
    }
  }

  forgetExpired(): Promise<number> {
    return this.deletedAccounts.forgetDeletedBefore(DELETED_ACCOUNT_RETENTION_DAYS);
  }
}
