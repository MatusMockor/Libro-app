import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { ReviewListsService } from '../application/review-lists.service.js';
import {
  readerReviewsParamsSchema,
  workReviewsParamsSchema,
  type ReaderReviewsParams,
  type WorkReviewsParams,
} from './review-params.request.js';
import {
  reviewPageQuerySchema,
  toReviewPageQuery,
  type ReviewPageRequest,
} from './review-page.request.js';
import {
  reviewPageSchema,
  toReviewPageResponse,
  type ReviewPageResponse,
} from './review.response.js';

@ApiTags('reviews')
@Controller()
export class ReviewListsController {
  constructor(private readonly lists: ReviewListsService) {}

  @Get('profiles/:userId/reviews')
  @ApiOkResponse({
    description:
      'The reviews of the user, newest first. Only the user and the readers following them see them; anyone else (and an unknown user) gets an empty page',
    standardSchema: reviewPageSchema,
  })
  async ofReader(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: readerReviewsParamsSchema }) { userId }: ReaderReviewsParams,
    @Query({ schema: reviewPageQuerySchema }) page: ReviewPageRequest,
  ): Promise<ReviewPageResponse> {
    return toReviewPageResponse(await this.lists.ofReader(id, userId, toReviewPageQuery(page)));
  }

  @Get('books/:workId/reviews')
  @ApiOkResponse({
    description:
      'The reviews of the book by you and the readers you follow, newest first. An unknown book gets an empty page',
    standardSchema: reviewPageSchema,
  })
  async ofWork(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: workReviewsParamsSchema }) { workId }: WorkReviewsParams,
    @Query({ schema: reviewPageQuerySchema }) page: ReviewPageRequest,
  ): Promise<ReviewPageResponse> {
    return toReviewPageResponse(await this.lists.ofWork(id, workId, toReviewPageQuery(page)));
  }
}
