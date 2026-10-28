import { computeTree, type TreeEngineVersion, type TreeV1 } from '@libro/tree-engine';
import type { ReadingWithSessions } from '../../reading-sessions/index.js';

export const TREE_PAGE_MAX_OFFSET = 1000;

export interface ReadingTree {
  readonly readingId: string;
  readonly workId: string;
  readonly finishedAt: Date | null;
  readonly tree: TreeV1;
}

export interface TreePageQuery {
  readonly limit: number;
  readonly offset: number;
}

export interface ReadingTreePage {
  readonly items: readonly ReadingTree[];
  readonly nextOffset: number | null;
}

export function growReadingTree(
  { id, workId, finishedAt, sessions }: ReadingWithSessions,
  version: TreeEngineVersion,
): ReadingTree {
  return {
    readingId: id,
    workId,
    finishedAt,
    tree: computeTree(
      { seed: id, finished: finishedAt !== null, sessions, decorations: [] },
      version,
    ),
  };
}
