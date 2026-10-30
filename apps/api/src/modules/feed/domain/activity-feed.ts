import type { FeedPageQuery } from './feed-page.js';

export const ACTIVITY_TABS = ['following', 'community'] as const;

export type ActivityTab = (typeof ACTIVITY_TABS)[number];

export const ACTIVITY_TYPES = ['all', 'announcements', 'reading', 'posts'] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type ActivitySource = 'posts' | 'announcements' | 'reading';

export const SOURCES_OF_TYPE: Readonly<Record<ActivityType, readonly ActivitySource[]>> = {
  all: ['posts', 'announcements', 'reading'],
  announcements: ['announcements'],
  reading: ['reading'],
  posts: ['posts'],
};

export interface ActivityFeedQuery {
  readonly tab: ActivityTab;
  readonly type: ActivityType;
  readonly page: FeedPageQuery;
}

export interface TimelineAudience {
  readonly everyonesPosts: boolean;
  readonly postAuthorIds: readonly string[];
  readonly readingActorIds: readonly string[];
}
