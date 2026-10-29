import { LATEST_TREE_ENGINE_VERSION } from '@libro/tree-engine';
import { Inject, Injectable } from '@nestjs/common';
import type { ReadingWithSessions } from '../../reading-sessions/index.js';
import {
  FINISHED_TREE_REPOSITORY,
  type FinishedTreeRepository,
} from './finished-tree-repository.js';
import { TreeEngineVersions } from './tree-engine-versions.js';

@Injectable()
export class FinishedTreeVersionsService {
  constructor(
    @Inject(FINISHED_TREE_REPOSITORY) private readonly finishedTrees: FinishedTreeRepository,
  ) {}

  record(userId: string, readingId: string): Promise<void> {
    return this.recordLatest(userId, [readingId]);
  }

  async resolve(
    userId: string,
    readings: readonly ReadingWithSessions[],
  ): Promise<TreeEngineVersions> {
    const finishedIds = readings
      .filter(({ finishedAt }) => finishedAt !== null)
      .map(({ id }) => id);

    return new TreeEngineVersions(await this.storedVersions(userId, finishedIds));
  }

  private async storedVersions(userId: string, readingIds: string[]): Promise<Map<string, number>> {
    if (readingIds.length === 0) {
      return new Map();
    }

    const stored = await this.finishedTrees.storedVersions(userId, readingIds);
    const unrecorded = readingIds.filter((id) => !stored.has(id));
    if (unrecorded.length === 0) {
      return stored;
    }

    await this.recordLatest(userId, unrecorded);
    return this.finishedTrees.storedVersions(userId, readingIds);
  }

  private recordLatest(userId: string, readingIds: readonly string[]): Promise<void> {
    return this.finishedTrees.record({
      userId,
      readingIds,
      treeEngineVersion: LATEST_TREE_ENGINE_VERSION,
    });
  }
}
