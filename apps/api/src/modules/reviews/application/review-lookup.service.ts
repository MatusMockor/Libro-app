import { Inject, Injectable } from '@nestjs/common';
import type { Review } from '../domain/review.js';
import { ReviewAssemblerService } from './review-assembler.service.js';
import { ReviewAudienceService } from './review-audience.service.js';
import { REVIEW_REPOSITORY, type ReviewRepository } from './review-repository.js';
import { ReviewNotFoundException } from './review-not-found.exception.js';

@Injectable()
export class ReviewLookupService {
  constructor(
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository,
    private readonly audience: ReviewAudienceService,
    private readonly assembler: ReviewAssemblerService,
  ) {}

  async find(viewerId: string, readingId: string): Promise<Review> {
    const readerIds = await this.audience.readersVisibleTo(viewerId);
    const stored = await this.reviews.findVisible(readingId, readerIds);
    if (!stored) {
      throw new ReviewNotFoundException();
    }

    return this.assembler.review(viewerId, stored);
  }
}
