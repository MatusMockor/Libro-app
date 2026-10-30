import type { NewReadingActivity, StoredActivity } from '../domain/activity.js';
import type { TimelineAudience } from '../domain/activity-feed.js';
import type { FeedPageQuery } from '../domain/feed-page.js';

export const FEED_TIMELINE = Symbol('FEED_TIMELINE');

export interface FeedTimeline {
  page(audience: TimelineAudience, page: FeedPageQuery): Promise<StoredActivity[]>;
  recordReading(activity: NewReadingActivity): Promise<void>;
}
