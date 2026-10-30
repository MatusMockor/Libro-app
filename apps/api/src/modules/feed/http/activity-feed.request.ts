import { z } from 'zod';
import { ACTIVITY_TABS, ACTIVITY_TYPES, type ActivityFeedQuery } from '../domain/activity-feed.js';
import { feedPageQuerySchema, toFeedPageQuery } from './feed-page.request.js';

export const activityFeedQuerySchema = z.object({
  tab: z.enum(ACTIVITY_TABS).default('following').meta({
    description:
      'Whose posts: following (yours and those you follow) or community (everyone); announcements and reading activity do not depend on it',
  }),
  type: z.enum(ACTIVITY_TYPES).default('all').meta({
    description:
      'announcements (posts of official Libro accounts), reading (books you and the readers you follow started or finished), posts (posts of the tab) or all of them',
  }),
  ...feedPageQuerySchema.shape,
});

export type ActivityFeedRequest = z.infer<typeof activityFeedQuerySchema>;

export function toActivityFeedQuery({
  tab,
  type,
  ...page
}: ActivityFeedRequest): ActivityFeedQuery {
  return { tab, type, page: toFeedPageQuery(page) };
}
