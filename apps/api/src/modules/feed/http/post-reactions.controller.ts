import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Put, Query } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { ReactionService } from '../application/reaction.service.js';
import { feedPageQuerySchema, toFeedPageQuery, type FeedPageRequest } from './feed-page.request.js';
import {
  postParamsSchema,
  reactionParamsSchema,
  type PostParams,
  type ReactionParams,
} from './post-params.request.js';
import {
  reactionPageSchema,
  toReactionPageResponse,
  type ReactionPageResponse,
} from './reaction.response.js';

@ApiTags('feed')
@Controller('posts/:postId/reactions')
export class PostReactionsController {
  constructor(private readonly reactions: ReactionService) {}

  @Get()
  @ApiOkResponse({
    description:
      'Who reacted to the post with what, newest first. An unknown post answers 404 post_not_found',
    standardSchema: reactionPageSchema,
  })
  async list(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: postParamsSchema }) { postId }: PostParams,
    @Query({ schema: feedPageQuerySchema }) page: FeedPageRequest,
  ): Promise<ReactionPageResponse> {
    return toReactionPageResponse(await this.reactions.list(id, postId, toFeedPageQuery(page)));
  }

  @Put(':reaction')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'You reacted to the post with the reaction, also when you already did. An unknown post answers 404 post_not_found',
  })
  async add(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: reactionParamsSchema }) { postId, reaction }: ReactionParams,
  ): Promise<void> {
    await this.reactions.add({ postId, userId: id, key: reaction });
  }

  @Delete(':reaction')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'Your reaction is removed from the post, also when there was none. An unknown post answers 404 post_not_found',
  })
  async remove(
    @CurrentUser() { id }: AuthenticatedUser,
    @Param({ schema: reactionParamsSchema }) { postId, reaction }: ReactionParams,
  ): Promise<void> {
    await this.reactions.remove({ postId, userId: id, key: reaction });
  }
}
