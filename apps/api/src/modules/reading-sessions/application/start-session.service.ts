import { Inject, Injectable } from '@nestjs/common';
import { BOOK_CATALOGUE, BookNotFoundException, type BookCatalogue } from '../../books/index.js';
import { normalisePlace } from '../domain/place.js';
import type { ReadingSession } from '../domain/reading-session.js';
import {
  READING_SESSION_REPOSITORY,
  type ReadingSessionRepository,
} from './reading-session-repository.js';
import { ReadingStartAnnouncer } from './reading-start-announcer.service.js';
import { SessionLookupService } from './session-lookup.service.js';

export interface SessionStart {
  readonly workId: string;
  readonly place: string | null;
}

@Injectable()
export class StartSessionService {
  constructor(
    @Inject(BOOK_CATALOGUE) private readonly catalogue: BookCatalogue,
    @Inject(READING_SESSION_REPOSITORY) private readonly sessions: ReadingSessionRepository,
    private readonly lookup: SessionLookupService,
    private readonly announcer: ReadingStartAnnouncer,
  ) {}

  async start(userId: string, { workId, place }: SessionStart): Promise<ReadingSession> {
    if (!(await this.catalogue.workExists(workId))) {
      throw new BookNotFoundException(workId);
    }

    const opened = await this.sessions.start({ userId, workId, place: normalisePlace(place) });
    await this.announcer.announce(userId, workId, opened);

    return this.lookup.get({ userId, sessionId: opened.sessionId });
  }
}
