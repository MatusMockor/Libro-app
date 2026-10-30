import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BooksModule } from '../books/index.js';
import { MediaModule } from '../media/index.js';
import { ProfilesModule } from '../profiles/index.js';
import { CreatePostService } from './application/create-post.service.js';
import { DeletePostService } from './application/delete-post.service.js';
import { EraseFeedDataHandler } from './application/erase-feed-data.handler.js';
import { FEED_ERASURE_REPOSITORY } from './application/feed-erasure-repository.js';
import { FeedService } from './application/feed.service.js';
import { LIKE_REPOSITORY } from './application/like-repository.js';
import { LikeService } from './application/like.service.js';
import { PostAssemblerService } from './application/post-assembler.service.js';
import { PostLookupService } from './application/post-lookup.service.js';
import { PostPhotosService } from './application/post-photos.service.js';
import { POST_REPOSITORY } from './application/post-repository.js';
import { REACTION_REPOSITORY } from './application/reaction-repository.js';
import { ReactionService } from './application/reaction.service.js';
import { FeedController } from './http/feed.controller.js';
import { PostLikesController } from './http/post-likes.controller.js';
import { PostReactionsController } from './http/post-reactions.controller.js';
import { PostsController } from './http/posts.controller.js';
import { LikeEntity } from './persistence/like.entity.js';
import { PostPhotoEntity } from './persistence/post-photo.entity.js';
import { PostEntity } from './persistence/post.entity.js';
import { ReactionEntity } from './persistence/reaction.entity.js';
import { TypeOrmFeedErasureRepository } from './persistence/typeorm-feed-erasure.repository.js';
import { TypeOrmLikeRepository } from './persistence/typeorm-like.repository.js';
import { TypeOrmPostRepository } from './persistence/typeorm-post.repository.js';
import { TypeOrmReactionRepository } from './persistence/typeorm-reaction.repository.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostEntity, PostPhotoEntity, LikeEntity, ReactionEntity]),
    BooksModule,
    MediaModule,
    ProfilesModule,
  ],
  controllers: [PostsController, PostLikesController, PostReactionsController, FeedController],
  providers: [
    PostPhotosService,
    PostAssemblerService,
    PostLookupService,
    CreatePostService,
    DeletePostService,
    FeedService,
    LikeService,
    ReactionService,
    EraseFeedDataHandler,
    { provide: POST_REPOSITORY, useClass: TypeOrmPostRepository },
    { provide: LIKE_REPOSITORY, useClass: TypeOrmLikeRepository },
    { provide: REACTION_REPOSITORY, useClass: TypeOrmReactionRepository },
    { provide: FEED_ERASURE_REPOSITORY, useClass: TypeOrmFeedErasureRepository },
  ],
})
export class FeedModule {}
