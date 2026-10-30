import { Inject, Injectable } from '@nestjs/common';
import { distinctIdBatch } from '../../../shared/id-batch.js';
import {
  MAX_DECORATED_READINGS_PER_CALL,
  MAX_DECORATIONS_PER_READING,
  type EncouragementDecoration,
  type ReadingEncouragements,
} from '../reading-encouragements.js';
import {
  ENCOURAGEMENT_REPOSITORY,
  type EncouragementRepository,
  type ReadingDecoration,
} from './encouragement-repository.js';

@Injectable()
export class ReadingEncouragementsService implements ReadingEncouragements {
  constructor(
    @Inject(ENCOURAGEMENT_REPOSITORY) private readonly encouragements: EncouragementRepository,
  ) {}

  async decorationsFor(
    readingIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly EncouragementDecoration[]>> {
    const distinct = distinctIdBatch(readingIds, MAX_DECORATED_READINGS_PER_CALL);
    if (distinct.length === 0) {
      return new Map();
    }

    return groupByReading(
      await this.encouragements.oldestDecorations(distinct, MAX_DECORATIONS_PER_READING),
    );
  }
}

function groupByReading(
  decorations: readonly ReadingDecoration[],
): Map<string, EncouragementDecoration[]> {
  const grouped = new Map<string, EncouragementDecoration[]>();
  for (const { readingId, id, kind } of decorations) {
    grouped.set(readingId, [...(grouped.get(readingId) ?? []), { id, kind }]);
  }

  return grouped;
}
