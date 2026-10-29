import {
  computeTree,
  type DecorationInputV1,
  type SessionInputV1,
  type TreeEngineVersion,
  type TreeV1,
} from '@libro/tree-engine';
import type { EndedSession, ReadingWithSessions } from '../../reading-sessions/index.js';

const GROUP_READING_ID_PREFIX = 'group:';

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
      {
        seed: id,
        finished: finishedAt !== null,
        sessions: sessions.map(toSessionInput),
        decorations: groupReadingDecorations(sessions),
      },
      version,
    ),
  };
}

function toSessionInput({ activeSeconds, checkpoints, markedParts }: EndedSession): SessionInputV1 {
  return { activeSeconds, checkpoints, markedParts };
}

function groupReadingDecorations(sessions: readonly EndedSession[]): DecorationInputV1[] {
  const hostSessionIds = new Set(
    sessions.flatMap(({ groupHostSessionIds }) => groupHostSessionIds),
  );

  return [...hostSessionIds].map((hostSessionId) => ({
    id: `${GROUP_READING_ID_PREFIX}${hostSessionId}`,
    kind: 'group_reading',
  }));
}
