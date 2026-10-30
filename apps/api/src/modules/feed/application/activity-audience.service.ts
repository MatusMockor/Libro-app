import { Inject, Injectable } from '@nestjs/common';
import {
  PROFILE_DIRECTORY,
  SOCIAL_GRAPH,
  type ProfileDirectory,
  type SocialGraph,
} from '../../profiles/index.js';
import {
  READING_ACTIVITY_SHARING,
  type ReadingActivitySharing,
} from '../../reading-sessions/index.js';
import {
  SOURCES_OF_TYPE,
  type ActivityFeedQuery,
  type TimelineAudience,
} from '../domain/activity-feed.js';

@Injectable()
export class ActivityAudienceService {
  constructor(
    @Inject(SOCIAL_GRAPH) private readonly graph: SocialGraph,
    @Inject(PROFILE_DIRECTORY) private readonly profiles: ProfileDirectory,
    @Inject(READING_ACTIVITY_SHARING) private readonly sharing: ReadingActivitySharing,
  ) {}

  async of(
    viewerId: string,
    { tab, type }: Pick<ActivityFeedQuery, 'tab' | 'type'>,
  ): Promise<TimelineAudience> {
    const sources = new Set(SOURCES_OF_TYPE[type]);
    const everyonesPosts = sources.has('posts') && tab === 'community';
    const followedPosts = sources.has('posts') && !everyonesPosts;
    const announcements = sources.has('announcements') && !everyonesPosts;
    const reading = sources.has('reading');
    const [followeeIds, officialIds] = await Promise.all([
      followedPosts || reading ? this.graph.followeeIdsOf(viewerId) : [],
      announcements ? this.profiles.officialUserIds() : [],
    ]);

    return {
      everyonesPosts,
      postAuthorIds: [...(followedPosts ? [viewerId, ...followeeIds] : []), ...officialIds],
      readingActorIds: reading
        ? [viewerId, ...(await this.sharing.sharingWithFollowers(followeeIds))]
        : [],
    };
  }
}
