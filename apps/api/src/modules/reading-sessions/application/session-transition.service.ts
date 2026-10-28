import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../events/event-bus.js';
import type { ReadingSession } from '../domain/reading-session.js';
import { TRANSITION_RULES, type SessionTransition } from '../domain/session-transition.js';
import { SessionEnded } from '../events/session-ended.event.js';
import { InvalidSessionTransitionException } from './invalid-session-transition.exception.js';
import {
  READING_SESSION_REPOSITORY,
  type ReadingSessionRepository,
  type SessionOwner,
} from './reading-session-repository.js';
import { SessionLookupService } from './session-lookup.service.js';

@Injectable()
export class SessionTransitionService {
  constructor(
    @Inject(READING_SESSION_REPOSITORY) private readonly sessions: ReadingSessionRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly lookup: SessionLookupService,
  ) {}

  async apply(owner: SessionOwner, transition: SessionTransition): Promise<ReadingSession> {
    const applied = await this.sessions.transition(owner, TRANSITION_RULES[transition]);
    const session = await this.lookup.get(owner);

    if (!applied) {
      throw new InvalidSessionTransitionException();
    }

    if (transition === 'end') {
      await this.events.publish(
        SessionEnded.create({
          sessionId: session.id,
          readingId: session.readingId,
          userId: owner.userId,
          workId: session.workId,
        }),
      );
    }

    return session;
  }
}
