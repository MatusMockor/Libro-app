import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../events/event-bus.js';
import { ReadingStarted } from '../events/reading-started.event.js';
import type { OpenedSession } from './reading-session-repository.js';

@Injectable()
export class ReadingStartAnnouncer {
  constructor(@Inject(EVENT_BUS) private readonly events: EventBus) {}

  async announce(userId: string, workId: string, session: OpenedSession): Promise<void> {
    if (!session.readingCreated) {
      return;
    }

    await this.events.publish(
      ReadingStarted.create({ readingId: session.readingId, userId, workId }),
    );
  }
}
