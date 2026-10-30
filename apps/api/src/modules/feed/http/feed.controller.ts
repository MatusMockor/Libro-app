import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { ActivityFeedService } from '../application/activity-feed.service.js';
import { FeedService } from '../application/feed.service.js';
import {
  activityFeedQuerySchema,
  toActivityFeedQuery,
  type ActivityFeedRequest,
} from './activity-feed.request.js';
import {
  activityPageSchema,
  toActivityPageResponse,
  type ActivityPageResponse,
} from './activity.response.js';
import { feedPageQuerySchema, toFeedPageQuery, type FeedPageRequest } from './feed-page.request.js';
import { postPageSchema, toPostPageResponse, type PostPageResponse } from './post.response.js';
import { reactionSet, reactionSetSchema, type ReactionSetResponse } from './reaction.response.js';

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(
    private readonly feed: FeedService,
    private readonly activities: ActivityFeedService,
  ) {}

  @Get('activity')
  @ApiOkResponse({
    description:
      'The feed of activities, newest first: posts of the tab, announcements of official Libro accounts, and the books you and the readers you follow started or finished (only from readers who share their reading activity), filtered by type',
    standardSchema: activityPageSchema,
  })
  async activity(
    @CurrentUser() { id }: AuthenticatedUser,
    @Query({ schema: activityFeedQuerySchema }) query: ActivityFeedRequest,
  ): Promise<ActivityPageResponse> {
    return toActivityPageResponse(await this.activities.page(id, toActivityFeedQuery(query)));
  }

  @Get('following')
  @ApiOkResponse({
    description: 'Your posts and the posts of the profiles you follow, newest first',
    standardSchema: postPageSchema,
  })
  async following(
    @CurrentUser() { id }: AuthenticatedUser,
    @Query({ schema: feedPageQuerySchema }) page: FeedPageRequest,
  ): Promise<PostPageResponse> {
    return toPostPageResponse(await this.feed.following(id, toFeedPageQuery(page)));
  }

  @Get('community')
  @ApiOkResponse({
    description: 'The posts of every reader, newest first',
    standardSchema: postPageSchema,
  })
  async community(
    @CurrentUser() { id }: AuthenticatedUser,
    @Query({ schema: feedPageQuerySchema }) page: FeedPageRequest,
  ): Promise<PostPageResponse> {
    return toPostPageResponse(await this.feed.community(id, toFeedPageQuery(page)));
  }

  @Get('reactions')
  @ApiOkResponse({
    description: 'The reactions a post can get, with their keys and emoji',
    standardSchema: reactionSetSchema,
  })
  reactions(): ReactionSetResponse {
    return reactionSet();
  }
}
