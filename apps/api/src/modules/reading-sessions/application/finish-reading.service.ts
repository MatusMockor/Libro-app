import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../events/event-bus.js';
import type { Reading } from '../domain/reading.js';
import { BookFinished } from '../events/book-finished.event.js';
import { ReadingAlreadyFinishedException } from './reading-already-finished.exception.js';
import { ReadingNotFoundException } from './reading-not-found.exception.js';
import {
  READING_REPOSITORY,
  type FinishOutcome,
  type ReadingOwner,
  type ReadingRepository,
} from './reading-repository.js';
import { ReadingSessionOpenException } from './reading-session-open.exception.js';

type Rejection = Exclude<FinishOutcome['kind'], 'finished'>;

const REJECTIONS: Readonly<Record<Rejection, new () => Error>> = {
  not_found: ReadingNotFoundException,
  already_finished: ReadingAlreadyFinishedException,
  session_open: ReadingSessionOpenException,
};

@Injectable()
export class FinishReadingService {
  constructor(
    @Inject(READING_REPOSITORY) private readonly readings: ReadingRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async finish(owner: ReadingOwner): Promise<Reading> {
    const outcome = await this.readings.finish(owner);
    if (outcome.kind !== 'finished') {
      throw new REJECTIONS[outcome.kind]();
    }

    const { reading } = outcome;
    await this.events.publish(
      BookFinished.create({ readingId: reading.id, userId: owner.userId, workId: reading.workId }),
    );

    return reading;
  }
}
