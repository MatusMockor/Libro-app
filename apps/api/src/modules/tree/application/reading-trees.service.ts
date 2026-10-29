import { Inject, Injectable } from '@nestjs/common';
import {
  READING_HISTORY,
  ReadingNotFoundException,
  type ReadingHistory,
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
    private readonly versions: FinishedTreeVersionsService,
  ) {}

  async treeOf(userId: string, readingId: string): Promise<ReadingTree> {
    const reading = await this.history.findReading(userId, readingId);
    if (!reading) {
      throw new ReadingNotFoundException();
    }

    const versions = await this.versions.resolve(userId, [reading]);
    return growReadingTree(reading, versions.of(reading));
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
    const versions = await this.versions.resolve(userId, readings);
    const nextOffset = offset + limit;
    const hasNextPage = found.length > limit && nextOffset <= TREE_PAGE_MAX_OFFSET;

    return {
      items: readings.map((reading) => growReadingTree(reading, versions.of(reading))),
      nextOffset: hasNextPage ? nextOffset : null,
    };
  }
}
