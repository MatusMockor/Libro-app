import type { Reading } from './domain/reading.js';
import type { NewMarkedPart } from './domain/reading-session.js';

export const READING_HISTORY = Symbol('READING_HISTORY');

export interface EndedSession {
  readonly activeSeconds: number;
  readonly checkpoints: readonly { readonly page: number }[];
  readonly markedParts: readonly NewMarkedPart[];
}

export interface ReadingWithSessions extends Reading {
  readonly sessions: readonly EndedSession[];
}

export interface ReadingHistoryQuery {
  readonly finished: boolean;
  readonly limit: number;
  readonly offset: number;
}

export interface ReadingHistory {
  findReading(userId: string, readingId: string): Promise<ReadingWithSessions | undefined>;
  listReadings(userId: string, query: ReadingHistoryQuery): Promise<ReadingWithSessions[]>;
}
