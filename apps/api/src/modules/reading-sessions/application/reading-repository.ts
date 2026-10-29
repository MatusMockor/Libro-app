import type { Reading } from '../domain/reading.js';

export const READING_REPOSITORY = Symbol('READING_REPOSITORY');

export interface ReadingOwner {
  readonly userId: string;
  readonly readingId: string;
}

export type FinishOutcome =
  | { readonly kind: 'finished'; readonly reading: Reading }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'already_finished' }
  | { readonly kind: 'session_open' };

export interface ReadingRepository {
  finish(owner: ReadingOwner): Promise<FinishOutcome>;
  deleteAllOf(userId: string): Promise<void>;
}
