import { Injectable } from '@nestjs/common';
import type { StoredActivity } from '../domain/activity.js';
import type { ActivityHydrator, HydrationPlan } from './activity-hydrator.js';
import { NO_REFERENCE_IDS } from './feed-references.service.js';
import { readingDetailsOf, workIdsOf } from './reading-activity-details.js';

@Injectable()
export class ReadingStartedHydrator implements ActivityHydrator {
  plan(_viewerId: string, activities: readonly StoredActivity[]): Promise<HydrationPlan> {
    return Promise.resolve({
      references: { ...NO_REFERENCE_IDS, workIds: workIdsOf(activities) },
      detailsOf: (activity, { works }) => readingDetailsOf(activity, works, null),
    });
  }
}
