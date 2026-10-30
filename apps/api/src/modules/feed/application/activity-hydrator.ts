import type { ActivityDetails, ActivityKind, StoredActivity } from '../domain/activity.js';
import type { FeedReferences, ReferenceIds } from './feed-references.service.js';

export const ACTIVITY_HYDRATORS = Symbol('ACTIVITY_HYDRATORS');

export interface HydrationPlan {
  readonly references: ReferenceIds;
  detailsOf(activity: StoredActivity, references: FeedReferences): ActivityDetails | undefined;
}

export interface ActivityHydrator {
  plan(viewerId: string, activities: readonly StoredActivity[]): Promise<HydrationPlan>;
}

export type ActivityHydrators = Readonly<Record<ActivityKind, ActivityHydrator>>;
