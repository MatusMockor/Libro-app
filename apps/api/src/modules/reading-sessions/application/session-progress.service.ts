import { Inject, Injectable } from '@nestjs/common';
import type { Checkpoint, MarkedPart, NewMarkedPart } from '../domain/reading-session.js';
import { ReadingSessionEndedException } from './reading-session-ended.exception.js';
import { ReadingSessionNotActiveException } from './reading-session-not-active.exception.js';
import {
  READING_SESSION_REPOSITORY,
  type ReadingSessionRepository,
  type SessionOwner,
} from './reading-session-repository.js';
import { SessionLookupService } from './session-lookup.service.js';

@Injectable()
export class SessionProgressService {
  constructor(
    @Inject(READING_SESSION_REPOSITORY) private readonly sessions: ReadingSessionRepository,
    private readonly lookup: SessionLookupService,
  ) {}

  async addCheckpoint(owner: SessionOwner, page: number): Promise<Checkpoint> {
    const checkpoint = await this.sessions.addCheckpoint(owner, page);
    if (checkpoint) {
      return checkpoint;
    }

    await this.lookup.get(owner);
    throw new ReadingSessionNotActiveException();
  }

  async markPart(owner: SessionOwner, part: NewMarkedPart): Promise<MarkedPart> {
    const marked = await this.sessions.addMarkedPart(owner, part);
    if (marked) {
      return marked;
    }

    await this.lookup.get(owner);
    throw new ReadingSessionEndedException();
  }
}
