import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../events/event-bus.js';
import { decorationIdOf } from '../domain/decoration-id.js';
import { MAX_INSIGHTS_PER_AUTHOR_AND_READING, type Insight } from '../domain/insight.js';
import { InsightAdded } from '../events/insight-added.event.js';
import { EncouragementAuthorsService } from './encouragement-authors.service.js';
import { EncouragementTargetService } from './encouragement-target.service.js';
import { InsightLimitReachedException } from './insight-limit-reached.exception.js';
import { INSIGHT_REPOSITORY, type InsightRepository } from './insight-repository.js';
import { ReadingFinishedException } from './reading-finished.exception.js';

@Injectable()
export class AddInsightService {
  constructor(
    @Inject(INSIGHT_REPOSITORY) private readonly insights: InsightRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly targets: EncouragementTargetService,
    private readonly authors: EncouragementAuthorsService,
  ) {}

  async add(authorId: string, readingId: string, text: string): Promise<Insight> {
    const reading = await this.targets.foreignReading(authorId, readingId);
    if (reading.finishedAt !== null) {
      throw new ReadingFinishedException();
    }

    const outcome = await this.insights.add(
      { readingId, readerId: reading.userId, authorId, text },
      { perAuthorAndReading: MAX_INSIGHTS_PER_AUTHOR_AND_READING },
    );
    if (outcome.kind === 'limit_reached') {
      throw new InsightLimitReachedException();
    }

    const { insight } = outcome;
    await this.events.publish(
      InsightAdded.create({
        insightId: insight.id,
        readingId,
        readerId: insight.readerId,
        authorId,
      }),
    );

    return this.authors.withAuthor(authorId, {
      ...insight,
      decorationId: decorationIdOf('insight', insight.id),
    });
  }
}
