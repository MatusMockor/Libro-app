import { Inject, Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../events/on-domain-event.decorator.js';
import { UserDeleted } from '../../auth/index.js';
import { FEED_ERASURE_REPOSITORY, type FeedErasureRepository } from './feed-erasure-repository.js';

@Injectable()
export class EraseFeedDataHandler {
  constructor(@Inject(FEED_ERASURE_REPOSITORY) private readonly erasure: FeedErasureRepository) {}

  @OnDomainEvent(UserDeleted)
  async onUserDeleted({ payload }: UserDeleted): Promise<void> {
    await this.erasure.eraseUser(payload.userId);
  }
}
