import { Inject, Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../events/on-domain-event.decorator.js';
import { UserDeleted } from '../../auth/index.js';
import { REVIEW_REPOSITORY, type ReviewRepository } from './review-repository.js';

@Injectable()
export class EraseReviewsHandler {
  constructor(@Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository) {}

  @OnDomainEvent(UserDeleted)
  async onUserDeleted({ payload }: UserDeleted): Promise<void> {
    await this.reviews.deleteAllOf(payload.userId);
  }
}
