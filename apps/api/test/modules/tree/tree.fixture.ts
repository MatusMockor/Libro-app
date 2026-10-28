import type { SessionInputV1 } from '@libro/tree-engine';
import type { Agent, Test } from 'supertest';
import type { DataSource } from 'typeorm';
import type { SeederFactoryManager } from 'typeorm-extension';
import { expect } from 'vitest';
import { WorkEntity } from '../../../src/modules/books/persistence/work.entity.js';
import type { NewMarkedPart } from '../../../src/modules/reading-sessions/domain/reading-session.js';
import type { ReadingSessionFactoryMeta } from '../../../src/modules/reading-sessions/factories/reading-session.factory.js';
import type { ReadingFactoryMeta } from '../../../src/modules/reading-sessions/factories/reading.factory.js';
import type { ReadingSessionResponse } from '../../../src/modules/reading-sessions/http/reading-session.response.js';
import { ReadingSessionEntity } from '../../../src/modules/reading-sessions/persistence/reading-session.entity.js';
import { ReadingEntity } from '../../../src/modules/reading-sessions/persistence/reading.entity.js';
import { integrationTest } from '../../support/integration-test.js';
import type { SignIn } from '../../support/sign-in.js';

const SESSIONS_ROUTE = '/v1/reading-sessions';

export const treeRoute = (readingId: string): string => `/v1/readings/${readingId}/tree`;

export interface PlannedSession {
  readonly activeSeconds: number;
  readonly checkpoints?: readonly number[];
  readonly markedParts?: readonly NewMarkedPart[];
  readonly open?: boolean;
}

export interface TreeReader {
  readonly id: string;
  get(path: string): Test;
  newReading(meta?: Omit<ReadingFactoryMeta, 'userId' | 'workId'>): Promise<ReadingEntity>;
  read(reading: ReadingEntity, session: PlannedSession): Promise<ReadingSessionResponse>;
  finish(reading: ReadingEntity): Promise<void>;
}

export type NewTreeReader = () => Promise<TreeReader>;

export interface StoredTree {
  readonly readingId: string;
  readonly userId: string;
  readonly treeEngineVersion: number;
}

function readerOf(
  http: Agent,
  factories: SeederFactoryManager,
  { id, authorization }: { id: string; authorization: string },
): TreeReader {
  const post = async (path: string, body: object = {}): Promise<void> => {
    const response = await http.post(path).set('Authorization', authorization).send(body);
    expect(response.status, `POST ${path}`).toBeLessThan(300);
  };
  const get = (path: string): Test => http.get(path).set('Authorization', authorization);

  return {
    id,
    get,
    newReading: async (meta = {}) => {
      const work = await factories.get(WorkEntity).save();

      return factories
        .get<ReadingEntity, ReadingFactoryMeta>(ReadingEntity)
        .setMeta({ ...meta, userId: id, workId: work.id })
        .save();
    },
    read: async (reading, { activeSeconds, checkpoints = [], markedParts = [], open = false }) => {
      const session = await factories
        .get<ReadingSessionEntity, ReadingSessionFactoryMeta>(ReadingSessionEntity)
        .setMeta({ reading, activeSeconds })
        .save();
      const route = `${SESSIONS_ROUTE}/${session.id}`;
      for (const page of checkpoints) {
        await post(`${route}/checkpoints`, { page });
      }
      for (const part of markedParts) {
        await post(`${route}/marked-parts`, part);
      }
      if (!open) {
        await post(`${route}/end`);
      }

      return (await get(route)).body as ReadingSessionResponse;
    },
    finish: (reading) => post(`/v1/readings/${reading.id}/finish`),
  };
}

function newReaderWith(
  http: Agent,
  factories: SeederFactoryManager,
  signIn: SignIn,
): NewTreeReader {
  return async () => readerOf(http, factories, await signIn());
}

export const test = integrationTest()
  .extend('newReader', ({ http, factories, signIn }) => newReaderWith(http, factories, signIn))
  .extend('reader', ({ newReader }) => newReader());

export function engineSession({
  activeSeconds,
  checkpoints,
  markedParts,
}: ReadingSessionResponse): SessionInputV1 {
  return {
    activeSeconds,
    checkpoints: checkpoints.map(({ page }) => ({ page })),
    markedParts: markedParts.map(({ kind, fromPage, toPage }) => ({ kind, fromPage, toPage })),
  };
}

export function storedTrees(dataSource: DataSource): Promise<StoredTree[]> {
  return dataSource.query<StoredTree[]>(
    `SELECT reading_id AS "readingId", user_id AS "userId", tree_engine_version AS "treeEngineVersion"
     FROM tree.finished_trees
     ORDER BY created_at, reading_id`,
  );
}
