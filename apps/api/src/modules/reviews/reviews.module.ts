import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BooksModule } from '../books/index.js';
import { MediaModule } from '../media/index.js';
import { ProfilesModule } from '../profiles/index.js';
import { ReadingSessionsModule } from '../reading-sessions/index.js';
import { DeleteReviewService } from './application/delete-review.service.js';
import { EraseReviewsHandler } from './application/erase-reviews.handler.js';
import { ReviewAssemblerService } from './application/review-assembler.service.js';
import { ReviewAudienceService } from './application/review-audience.service.js';
import { ReviewListsService } from './application/review-lists.service.js';
import { ReviewLookupService } from './application/review-lookup.service.js';
import { REVIEW_REPOSITORY } from './application/review-repository.js';
import { WriteReviewService } from './application/write-review.service.js';
import { ReviewListsController } from './http/review-lists.controller.js';
import { ReviewsController } from './http/reviews.controller.js';
import { ReviewEntity } from './persistence/review.entity.js';
import { TypeOrmReviewRepository } from './persistence/typeorm-review.repository.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReviewEntity]),
    ReadingSessionsModule,
    ProfilesModule,
    BooksModule,
    MediaModule,
  ],
  controllers: [ReviewsController, ReviewListsController],
  providers: [
    ReviewAudienceService,
    ReviewAssemblerService,
    WriteReviewService,
    DeleteReviewService,
    ReviewLookupService,
    ReviewListsService,
    EraseReviewsHandler,
    { provide: REVIEW_REPOSITORY, useClass: TypeOrmReviewRepository },
  ],
})
export class ReviewsModule {}
