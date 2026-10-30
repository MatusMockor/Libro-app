import { Inject, Injectable } from '@nestjs/common';
import { REVIEW_REPOSITORY, type ReviewRepository } from './review-repository.js';
import { ReviewNotFoundException } from './review-not-found.exception.js';

@Injectable()
export class DeleteReviewService {
  constructor(@Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository) {}

  async delete(userId: string, readingId: string): Promise<void> {
    if (!(await this.reviews.deleteOwned(userId, readingId))) {
      throw new ReviewNotFoundException();
    }
  }
}
