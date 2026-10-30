import type {
  Checkpoint,
  MarkedPart,
  NewMarkedPart,
  ReadingSession,
} from '../domain/reading-session.js';
import type { TransitionRule } from '../domain/session-transition.js';

export const READING_SESSION_REPOSITORY = Symbol('READING_SESSION_REPOSITORY');

export interface SessionOwner {
  readonly userId: string;
  readonly sessionId: string;
}

export interface NewReadingSession {
  readonly userId: string;
  readonly workId: string;
  readonly place: string | null;
}

export interface OpenedSession {
  readonly sessionId: string;
  readonly readingId: string;
  readonly readingCreated: boolean;
}

export interface ReadingSessionRepository {
  start(session: NewReadingSession): Promise<OpenedSession>;
  findById(owner: SessionOwner): Promise<ReadingSession | undefined>;
  findOpen(userId: string): Promise<ReadingSession | undefined>;
  transition(owner: SessionOwner, rule: TransitionRule): Promise<boolean>;
  addCheckpoint(owner: SessionOwner, page: number): Promise<Checkpoint | undefined>;
  addMarkedPart(owner: SessionOwner, part: NewMarkedPart): Promise<MarkedPart | undefined>;
}
