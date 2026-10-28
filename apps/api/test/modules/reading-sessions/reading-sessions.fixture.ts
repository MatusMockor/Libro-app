import type { Agent, Test } from 'supertest';
import type { DataSource } from 'typeorm';
import type { SeederFactoryManager } from 'typeorm-extension';
import { WorkEntity } from '../../../src/modules/books/persistence/work.entity.js';
import type { SessionStatus } from '../../../src/modules/reading-sessions/domain/reading-session.js';
import type { ReadingSessionFactoryMeta } from '../../../src/modules/reading-sessions/factories/reading-session.factory.js';
import type { ReadingFactoryMeta } from '../../../src/modules/reading-sessions/factories/reading.factory.js';
import type { ReadingSessionResponse } from '../../../src/modules/reading-sessions/http/reading-session.response.js';
import { ReadingSessionEntity } from '../../../src/modules/reading-sessions/persistence/reading-session.entity.js';
import { ReadingEntity } from '../../../src/modules/reading-sessions/persistence/reading.entity.js';
import { integrationTest } from '../../support/integration-test.js';
import { ProbeReadingSessionsSubscriberModule } from '../../support/probe-events/reading-sessions/probe-reading-sessions-subscriber.module.js';
import { ProbeEventRecorder } from '../../support/probe-events/subscriber/probe-event-recorder.js';
import type { SignIn } from '../../support/sign-in.js';

export const SESSIONS_ROUTE = '/v1/reading-sessions';

export interface Reader {
  readonly id: string;
  readonly workId: string;
  get(path: string): Test;
  post(path: string, body?: object): Test;
  start(body?: object): Test;
  startedSession(status?: SessionStatus): Promise<ReadingSessionResponse>;
  arrangeSession(meta: Omit<ReadingSessionFactoryMeta, 'reading'>): Promise<ReadingSessionEntity>;
}

export type NewReader = () => Promise<Reader>;

const TRANSITION_TO: Readonly<Record<SessionStatus, string | undefined>> = {
  active: undefined,
  paused: 'pause',
  ended: 'end',
};

function readerOf(
  http: Agent,
  factories: SeederFactoryManager,
  { id, authorization }: { id: string; authorization: string },
  workId: string,
): Reader {
  const reader: Reader = {
    id,
    workId,
    get: (path) => http.get(path).set('Authorization', authorization),
    post: (path, body = {}) => http.post(path).set('Authorization', authorization).send(body),
    start: (body = {}) => reader.post(SESSIONS_ROUTE, { workId, ...body }),
    startedSession: async (status = 'active') => {
      const session = (await reader.start()).body as ReadingSessionResponse;
      const transition = TRANSITION_TO[status];
      if (!transition) {
        return session;
      }

      return (await reader.post(`${SESSIONS_ROUTE}/${session.id}/${transition}`))
        .body as ReadingSessionResponse;
    },
    arrangeSession: async (meta) => {
      const reading = await factories
        .get<ReadingEntity, ReadingFactoryMeta>(ReadingEntity)
        .setMeta({ userId: id, workId })
        .save();

      return factories
        .get<ReadingSessionEntity, ReadingSessionFactoryMeta>(ReadingSessionEntity)
        .setMeta({ ...meta, reading })
        .save();
    },
  };

  return reader;
}

function newReaderWith(http: Agent, factories: SeederFactoryManager, signIn: SignIn): NewReader {
  return async () => {
    const user = await signIn();
    const work = await factories.get(WorkEntity).save();

    return readerOf(http, factories, user, work.id);
  };
}

export const test = integrationTest({ imports: [ProbeReadingSessionsSubscriberModule] })
  .extend('recorder', ({ app }) => {
    const recorder = app.get(ProbeEventRecorder);
    recorder.clear();

    return recorder;
  })
  .extend('newReader', ({ http, factories, signIn }) => newReaderWith(http, factories, signIn))
  .extend('reader', ({ newReader }) => newReader());

export interface StoredCounts {
  readings: number;
  sessions: number;
  checkpoints: number;
  markedParts: number;
}

export async function storedCounts(dataSource: DataSource): Promise<StoredCounts | undefined> {
  const [counts] = await dataSource.query<StoredCounts[]>(
    `SELECT
       (SELECT count(*)::int FROM reading.readings) AS "readings",
       (SELECT count(*)::int FROM reading.sessions) AS "sessions",
       (SELECT count(*)::int FROM reading.checkpoints) AS "checkpoints",
       (SELECT count(*)::int FROM reading.marked_parts) AS "markedParts"`,
  );

  return counts;
}
