import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { CreatePostService } from '../application/create-post.service.js';
import { DeletePostService } from '../application/delete-post.service.js';
import { FeedService } from '../application/feed.service.js';
import { PostLookupService } from '../application/post-lookup.service.js';
import { createPostSchema, toNewPost, type CreatePostRequest } from './create-post.request.js';
import {
  authorPostsQuerySchema,
  toFeedPageQuery,
  type AuthorPostsRequest,
} from './feed-page.request.js';
import { postParamsSchema, type PostParams } from './post-params.request.js';
import {
  postPageSchema,
  postSchema,
  toPostPageResponse,
  toPostResponse,
  type PostPageResponse,
  type PostResponse,
} from './post.response.js';

const NOT_FOUND = 'An unknown post answers 404 post_not_found';

@ApiTags('feed')
@Controller('posts')
export class PostsController {
  constructor(
    private readonly creation: CreatePostService,
    private readonly lookup: PostLookupService,
    private readonly deletion: DeletePostService,
    private readonly feed: FeedService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    description:
      'The post was published to the feed. An unknown book answers 404 book_not_found, a photo that is not one of yours 404 media_not_found, more than 30 posts in 24 hours 429 post_limit_reached (Retry-After)',
    standardSchema: postSchema,
  })
  async create(
    @CurrentUser() { id }: AuthenticatedUser,
    @Body({ schema: createPostSchema }) post: CreatePostRequest,
  ): Promise<PostResponse> {
    return toPostResponse(await this.creation.create(toNewPost(id, post)));
  }

  @Get()
  @ApiOkResponse({
    description: 'The posts of one user, newest first; an unknown user has no posts',
    standardSchema: postPageSchema,
  })
  async byAuthor(
    @CurrentUser() { id }: AuthenticatedUser,
    @Query({ schema: authorPostsQuerySchema }) { authorId, ...page }: AuthorPostsRequest,
  ): Promise<PostPageResponse> {
    return toPostPageResponse(await this.feed.byAuthor(id, authorId, toFeedPageQuery(page)));
  }

  @Get(':postId')
  @ApiOkResponse({ description: `The post. ${NOT_FOUND}`, standardSchema: postSchema })
  async find(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: postParamsSchema }) { postId }: PostParams,
  ): Promise<PostResponse> {
    return toPostResponse(await this.lookup.get(id, postId));
  }

  @Delete(':postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'The post was deleted with its likes and reactions. An unknown post or one of another user answers 404 post_not_found',
  })
  async delete(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: postParamsSchema }) { postId }: PostParams,
  ): Promise<void> {
    await this.deletion.delete(id, postId);
  }
}
