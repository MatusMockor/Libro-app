import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../events/event-bus.js';
import {
  READING_HISTORY,
  ReadingNotFoundException,
  type ReadingHistory,
} from '../../reading-sessions/index.js';
import type { NewReview, Review, ReviewDraft } from '../domain/review.js';
import { ReviewPublished } from '../events/review-published.event.js';
import { ReadingNotFinishedException } from './reading-not-finished.exception.js';
import { ReviewAssemblerService } from './review-assembler.service.js';
import { REVIEW_REPOSITORY, type ReviewRepository } from './review-repository.js';

@Injectable()
export class WriteReviewService {
  constructor(
    @Inject(READING_HISTORY) private readonly history: ReadingHistory,
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly assembler: ReviewAssemblerService,
  ) {}

  async write(userId: string, readingId: string, draft: ReviewDraft): Promise<Review> {
    const review = await this.newReview(userId, readingId, draft);
    const saved = await this.reviews.save(review);
    if (!saved) {
      throw new ReadingNotFoundException();
    }

    if (saved.created) {
      await this.events.publish(
        ReviewPublished.create({ readingId, userId, workId: review.workId }),
      );
    }

    return this.assembler.review(userId, saved.review);
  }

  private async newReview(
    userId: string,
    readingId: string,
    draft: ReviewDraft,
  ): Promise<NewReview> {
    const reading = await this.history.findReading(userId, readingId);
    if (!reading) {
      throw new ReadingNotFoundException();
    }

    if (reading.finishedAt === null) {
      throw new ReadingNotFinishedException();
    }

    return { ...draft, readingId, userId, workId: reading.workId, finishedAt: reading.finishedAt };
  }
}
