import { Inject, Injectable } from '@nestjs/common';
import type { Activity, ActivityDetails, StoredActivity } from '../domain/activity.js';
import type { ActivityFeedQuery } from '../domain/activity-feed.js';
import { lookahead, pageOf, type FeedPage } from '../domain/feed-page.js';
import { ActivityAudienceService } from './activity-audience.service.js';
import {
  ACTIVITY_HYDRATORS,
  type ActivityHydrator,
  type ActivityHydrators,
  type HydrationPlan,
} from './activity-hydrator.js';
import {
  FeedReferencesService,
  mergeReferenceIds,
  NO_REFERENCE_IDS,
  type FeedReferences,
} from './feed-references.service.js';
import { FEED_TIMELINE, type FeedTimeline } from './feed-timeline.js';

@Injectable()
export class ActivityFeedService {
  constructor(
    @Inject(FEED_TIMELINE) private readonly timeline: FeedTimeline,
    @Inject(ACTIVITY_HYDRATORS) private readonly hydrators: ActivityHydrators,
    private readonly audiences: ActivityAudienceService,
    private readonly references: FeedReferencesService,
  ) {}

  async page(viewerId: string, query: ActivityFeedQuery): Promise<FeedPage<Activity>> {
    const audience = await this.audiences.of(viewerId, query);
    const found = await this.timeline.page(audience, lookahead(query.page));
    const { items, nextCursor } = pageOf(found, query.page);

    return { items: await this.hydrate(viewerId, items), nextCursor };
  }

  private async hydrate(
    viewerId: string,
    activities: readonly StoredActivity[],
  ): Promise<Activity[]> {
    const plans = await this.plansFor(viewerId, activities);
    const references = await this.references.resolve(
      viewerId,
      mergeReferenceIds([
        { ...NO_REFERENCE_IDS, profileIds: activities.map(({ actorId }) => actorId) },
        ...[...plans.values()].map((plan) => plan.references),
      ]),
    );

    return activities.flatMap((activity) => {
      const details = plans.get(this.hydrators[activity.kind])?.detailsOf(activity, references);

      return details ? [toActivity(activity, details, references)] : [];
    });
  }

  private async plansFor(
    viewerId: string,
    activities: readonly StoredActivity[],
  ): Promise<Map<ActivityHydrator, HydrationPlan>> {
    const groups = new Map<ActivityHydrator, StoredActivity[]>();
    for (const activity of activities) {
      const hydrator = this.hydrators[activity.kind];
      const group = groups.get(hydrator) ?? [];
      group.push(activity);
      groups.set(hydrator, group);
    }

    const plans = await Promise.all(
      [...groups].map(async ([hydrator, group]) => {
        const plan = await hydrator.plan(viewerId, group);

        return [hydrator, plan] as const;
      }),
    );

    return new Map(plans);
  }
}

function toActivity(
  { id, kind, actorId, createdAt }: StoredActivity,
  details: ActivityDetails,
  { profiles }: FeedReferences,
): Activity {
  return { id, kind, actorId, actor: profiles.get(actorId) ?? null, createdAt, ...details };
}
