import type { EncouragementKind } from './domain/encouragement.js';

export const READING_ENCOURAGEMENTS = Symbol('READING_ENCOURAGEMENTS');

export const MAX_DECORATIONS_PER_READING = 100;

export const MAX_DECORATED_READINGS_PER_CALL = 100;

export interface EncouragementDecoration {
  readonly id: string;
  readonly kind: EncouragementKind;
}

export interface ReadingEncouragements {
  decorationsFor(
    readingIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly EncouragementDecoration[]>>;
}
