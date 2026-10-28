import { Inject, Injectable } from '@nestjs/common';
import type { ReadingSession } from '../domain/reading-session.js';
import { ReadingSessionNotFoundException } from './reading-session-not-found.exception.js';
import {
  READING_SESSION_REPOSITORY,
  type ReadingSessionRepository,
  type SessionOwner,
} from './reading-session-repository.js';

@Injectable()
export class SessionLookupService {
  constructor(
    @Inject(READING_SESSION_REPOSITORY) private readonly sessions: ReadingSessionRepository,
  ) {}

  async get(owner: SessionOwner): Promise<ReadingSession> {
    return found(await this.sessions.findById(owner));
  }

  async current(userId: string): Promise<ReadingSession> {
    return found(await this.sessions.findOpen(userId));
  }
}

function found(session: ReadingSession | undefined): ReadingSession {
  if (!session) {
    throw new ReadingSessionNotFoundException();
  }

  return session;
}
