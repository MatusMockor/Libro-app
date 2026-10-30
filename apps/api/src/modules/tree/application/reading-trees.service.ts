import { Inject, Injectable } from '@nestjs/common';
import { READING_ENCOURAGEMENTS, type ReadingEncouragements } from '../../encouragements/index.js';
import {
  READING_HISTORY,
  ReadingNotFoundException,
  type ReadingHistory,
  type ReadingWithSessions,
} from '../../reading-sessions/index.js';
import {
  growReadingTree,
  TREE_PAGE_MAX_OFFSET,
  type ReadingTree,
  type ReadingTreePage,
  type TreePageQuery,
} from '../domain/reading-tree.js';
import { FinishedTreeVersionsService } from './finished-tree-versions.service.js';

@Injectable()
export class ReadingTreesService {
  constructor(
    @Inject(READING_HISTORY) private readonly history: ReadingHistory,
    @Inject(READING_ENCOURAGEMENTS) private readonly encouragements: ReadingEncouragements,
    private readonly versions: FinishedTreeVersionsService,
  ) {}

  async treeOf(userId: string, readingId: string): Promise<ReadingTree> {
    const reading = await this.history.findReading(userId, readingId);
    if (!reading) {
      throw new ReadingNotFoundException();
    }

    const grow = await this.growerFor(userId, [reading]);
    return grow(reading);
  }

  forest(userId: string, page: TreePageQuery): Promise<ReadingTreePage> {
    return this.page(userId, true, page);
  }

  growingTrees(userId: string, page: TreePageQuery): Promise<ReadingTreePage> {
    return this.page(userId, false, page);
  }

  private async page(
    userId: string,
    finished: boolean,
    { limit, offset }: TreePageQuery,
  ): Promise<ReadingTreePage> {
    const found = await this.history.listReadings(userId, { finished, limit: limit + 1, offset });
    const readings = found.slice(0, limit);
    const nextOffset = offset + limit;
    const hasNextPage = found.length > limit && nextOffset <= TREE_PAGE_MAX_OFFSET;

    return {
      items: readings.map(await this.growerFor(userId, readings)),
      nextOffset: hasNextPage ? nextOffset : null,
    };
  }

  private async growerFor(
    userId: string,
    readings: readonly ReadingWithSessions[],
  ): Promise<(reading: ReadingWithSessions) => ReadingTree> {
    const [versions, decorations] = await Promise.all([
      this.versions.resolve(userId, readings),
      this.encouragements.decorationsFor(readings.map(({ id }) => id)),
    ]);

    return (reading) =>
      growReadingTree(reading, versions.of(reading), decorations.get(reading.id) ?? []);
  }
}
