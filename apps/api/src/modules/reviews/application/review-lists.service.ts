import { Inject, Injectable } from '@nestjs/common';
import {
  EMPTY_REVIEW_PAGE,
  lookahead,
  pageOf,
  type ReviewPage,
  type ReviewPageQuery,
} from '../domain/review-page.js';
import type { Review, StoredReview } from '../domain/review.js';
import { ReviewAssemblerService } from './review-assembler.service.js';
import { ReviewAudienceService } from './review-audience.service.js';
import { REVIEW_REPOSITORY, type ReviewRepository } from './review-repository.js';

@Injectable()
export class ReviewListsService {
  constructor(
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository,
    private readonly audience: ReviewAudienceService,
    private readonly assembler: ReviewAssemblerService,
  ) {}

  async ofReader(
    viewerId: string,
    readerId: string,
    page: ReviewPageQuery,
  ): Promise<ReviewPage<Review>> {
    if (!(await this.audience.canSee(viewerId, readerId))) {
      return EMPTY_REVIEW_PAGE;
    }

    return this.page(viewerId, await this.reviews.listByReader(readerId, lookahead(page)), page);
  }

  async ofWork(
    viewerId: string,
    workId: string,
    page: ReviewPageQuery,
  ): Promise<ReviewPage<Review>> {
    const readerIds = await this.audience.readersVisibleTo(viewerId);
    const found = await this.reviews.listByWork(workId, readerIds, lookahead(page));

    return this.page(viewerId, found, page);
  }

  private async page(
    viewerId: string,
    found: readonly StoredReview[],
    query: ReviewPageQuery,
  ): Promise<ReviewPage<Review>> {
    const { items, nextCursor } = pageOf(found, query);

    return { items: await this.assembler.reviews(viewerId, items), nextCursor };
  }
}
