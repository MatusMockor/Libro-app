import type { Reading } from './domain/reading.js';
import type { NewMarkedPart } from './domain/reading-session.js';

export const READING_HISTORY = Symbol('READING_HISTORY');

export interface EndedSession {
  readonly activeSeconds: number;
  readonly checkpoints: readonly { readonly page: number }[];
  readonly markedParts: readonly NewMarkedPart[];
  readonly groupHostSessionIds: readonly string[];
}

export interface ReadingWithSessions extends Reading {
  readonly sessions: readonly EndedSession[];
}

export interface ReadingHistoryQuery {
  readonly finished: boolean;
  readonly limit: number;
  readonly offset: number;
}

export interface ReadingSummary {
  readonly readingId: string;
  readonly userId: string;
  readonly workId: string;
  readonly finishedAt: Date | null;
}

export interface ReadingHistory {
  findReading(userId: string, readingId: string): Promise<ReadingWithSessions | undefined>;
  findReadingSummary(
    readingId: string,
    ownerIds: readonly string[],
  ): Promise<ReadingSummary | undefined>;
  listReadings(userId: string, query: ReadingHistoryQuery): Promise<ReadingWithSessions[]>;
}
