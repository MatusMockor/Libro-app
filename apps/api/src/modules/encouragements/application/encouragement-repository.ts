import type { StoredEncouragement } from '../domain/encouragement.js';
import type { EncouragementListQuery } from '../domain/encouragement-page.js';
import type { EncouragementDecoration } from '../reading-encouragements.js';

export const ENCOURAGEMENT_REPOSITORY = Symbol('ENCOURAGEMENT_REPOSITORY');

export interface ReadingDecoration extends EncouragementDecoration {
  readonly readingId: string;
}

export interface EncouragementRepository {
  list(query: EncouragementListQuery): Promise<StoredEncouragement[]>;
  oldestDecorations(
    readingIds: readonly string[],
    perReading: number,
  ): Promise<ReadingDecoration[]>;
  deleteAllOf(userId: string): Promise<void>;
}
