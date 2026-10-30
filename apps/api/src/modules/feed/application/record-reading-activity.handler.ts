import { Inject, Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../events/on-domain-event.decorator.js';
import {
  BookFinished,
  ReadingStarted,
  type ReadingStartedPayload,
} from '../../reading-sessions/index.js';
import type { ReadingActivityKind } from '../domain/activity.js';
import { FEED_TIMELINE, type FeedTimeline } from './feed-timeline.js';

@Injectable()
export class RecordReadingActivityHandler {
  constructor(@Inject(FEED_TIMELINE) private readonly timeline: FeedTimeline) {}

  @OnDomainEvent(ReadingStarted)
  async onReadingStarted({ payload }: ReadingStarted): Promise<void> {
    await this.record('reading_started', payload);
  }

  @OnDomainEvent(BookFinished)
  async onBookFinished({ payload }: BookFinished): Promise<void> {
    await this.record('book_finished', payload);
  }

  private record(
    kind: ReadingActivityKind,
    { readingId, userId, workId }: ReadingStartedPayload,
  ): Promise<void> {
    return this.timeline.recordReading({ kind, actorId: userId, readingId, workId });
  }
}
