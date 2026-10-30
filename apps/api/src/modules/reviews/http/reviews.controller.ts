import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { DeleteReviewService } from '../application/delete-review.service.js';
import { ReviewLookupService } from '../application/review-lookup.service.js';
import { WriteReviewService } from '../application/write-review.service.js';
import { blankToNull } from '../domain/review-text.js';
import { reviewParamsSchema, type ReviewParams } from './review-params.request.js';
import { reviewSchema, toReviewResponse, type ReviewResponse } from './review.response.js';
import { writeReviewSchema, type WriteReviewRequest } from './write-review.request.js';

@ApiTags('reviews')
@Controller('readings/:readingId/review')
export class ReviewsController {
  constructor(
    private readonly writing: WriteReviewService,
    private readonly lookup: ReviewLookupService,
    private readonly deleting: DeleteReviewService,
  ) {}

  @Put()
  @ApiOkResponse({
    description:
      'Creates or replaces your review of the finished reading. An unknown or foreign reading answers 404 reading_not_found, an unfinished one 409 reading_not_finished, a photo that is not one of yours 404 media_not_found',
    standardSchema: reviewSchema,
  })
  async write(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: reviewParamsSchema }) { readingId }: ReviewParams,
    @Body({ schema: writeReviewSchema }) { rating, text, photoId }: WriteReviewRequest,
  ): Promise<ReviewResponse> {
    return toReviewResponse(
      await this.writing.write(id, readingId, {
        rating,
        text: blankToNull(text),
        photoMediaId: photoId ?? null,
      }),
    );
  }

  @Get()
  @ApiOkResponse({
    description:
      'The review of the reading, for its reader and the readers following them. Otherwise, or without a review, 404 review_not_found',
    standardSchema: reviewSchema,
  })
  async find(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: reviewParamsSchema }) { readingId }: ReviewParams,
  ): Promise<ReviewResponse> {
    return toReviewResponse(await this.lookup.find(id, readingId));
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'Deletes your review of the reading. No review of yours answers 404 review_not_found',
  })
  async delete(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: reviewParamsSchema }) { readingId }: ReviewParams,
  ): Promise<void> {
    await this.deleting.delete(id, readingId);
  }
}
