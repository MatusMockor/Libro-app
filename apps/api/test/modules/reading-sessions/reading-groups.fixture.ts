import type { Agent, Test } from 'supertest';
import type { DataSource } from 'typeorm';
import type { SeederFactoryManager } from 'typeorm-extension';
import { expect } from 'vitest';
import { WorkEntity } from '../../../src/modules/books/persistence/work.entity.js';
import type { ProfileFactoryMeta } from '../../../src/modules/profiles/factories/profile.factory.js';
import { ProfileEntity } from '../../../src/modules/profiles/persistence/profile.entity.js';
import type { LiveSessionSharing } from '../../../src/modules/reading-sessions/domain/live-session-sharing.js';
import type { SessionStatus } from '../../../src/modules/reading-sessions/domain/reading-session.js';
import type { ReadingSessionFactoryMeta } from '../../../src/modules/reading-sessions/factories/reading-session.factory.js';
import type { SessionParticipantFactoryMeta } from '../../../src/modules/reading-sessions/factories/session-participant.factory.js';
import type { ReadingSessionResponse } from '../../../src/modules/reading-sessions/http/reading-session.response.js';
import { ReadingSessionEntity } from '../../../src/modules/reading-sessions/persistence/reading-session.entity.js';
import { SessionParticipantEntity } from '../../../src/modules/reading-sessions/persistence/session-participant.entity.js';
import { integrationTest } from '../../support/integration-test.js';
import type { SignIn } from '../../support/sign-in.js';

export const SESSIONS_ROUTE = '/v1/reading-sessions';

export const LIVE_ROUTE = `${SESSIONS_ROUTE}/live`;

export const PRIVACY_ROUTE = '/v1/me/reading-privacy';

export const sessionRoute = (sessionId: string): string => `${SESSIONS_ROUTE}/${sessionId}`;

export const groupRoute = (sessionId: string): string => `${sessionRoute(sessionId)}/group`;

export const joinRoute = (sessionId: string): string => `${sessionRoute(sessionId)}/join`;

export const leaveRoute = (sessionId: string): string => `${sessionRoute(sessionId)}/leave`;

export const participantRoute = (hostSessionId: string, participantSessionId: string): string =>
  `${sessionRoute(hostSessionId)}/participants/${participantSessionId}`;

export interface GroupReader {
  readonly id: string;
  readonly authorization: string;
  get(path: string): Test;
  post(path: string, body?: object): Test;
  put(path: string, body?: object): Test;
  delete(path: string): Test;
  follows(...readers: readonly { readonly id: string }[]): Promise<void>;
  shareLiveSessions(sharing: LiveSessionSharing): Promise<void>;
  startReading(workId: string, body?: object): Promise<ReadingSessionResponse>;
  joined(sessionId: string, body?: object): Promise<ReadingSessionResponse>;
  ended(sessionId: string): Promise<ReadingSessionResponse>;
  session(sessionId: string): Promise<ReadingSessionResponse>;
}

export type NewGroupReader = (profile?: ProfileFactoryMeta) => Promise<GroupReader>;

export type NewWork = () => Promise<string>;

export type ArrangeParticipants = (
  hostSessionId: string,
  count: number,
  meta?: ParticipantArrangement,
) => Promise<string[]>;

export interface ParticipantArrangement extends Omit<
  SessionParticipantFactoryMeta,
  'hostSessionId' | 'participantSessionId'
> {
  readonly sessionStatus?: SessionStatus;
}

function expectStatus(response: { status: number }, status: number, step: string): void {
  expect(response.status, step).toBe(status);
}

function readerOf(http: Agent, id: string, authorization: string): GroupReader {
  const reader: GroupReader = {
    id,
    authorization,
    get: (path) => http.get(path).set('Authorization', authorization),
    post: (path, body = {}) => http.post(path).set('Authorization', authorization).send(body),
    put: (path, body = {}) => http.put(path).set('Authorization', authorization).send(body),
    delete: (path) => http.delete(path).set('Authorization', authorization),
    follows: async (...readers) => {
      for (const followee of readers) {
        expectStatus(await reader.put(`/v1/profiles/${followee.id}/follow`), 204, 'follow');
      }
    },
    shareLiveSessions: async (liveSessions) => {
      expectStatus(await reader.put(PRIVACY_ROUTE, { liveSessions }), 200, 'privacy');
    },
    startReading: async (workId, body = {}) => {
      const response = await reader.post(SESSIONS_ROUTE, { workId, ...body });
      expectStatus(response, 201, 'start');

      return response.body as ReadingSessionResponse;
    },
    joined: async (sessionId, body = {}) => {
      const response = await reader.post(joinRoute(sessionId), body);
      expectStatus(response, 201, 'join');

      return response.body as ReadingSessionResponse;
    },
    ended: async (sessionId) => {
      const response = await reader.post(`${sessionRoute(sessionId)}/end`);
      expectStatus(response, 200, 'end');

      return response.body as ReadingSessionResponse;
    },
    session: async (sessionId) => {
      const response = await reader.get(sessionRoute(sessionId));
      expectStatus(response, 200, 'session');

      return response.body as ReadingSessionResponse;
    },
  };

  return reader;
}

function newGroupReaderWith(
  http: Agent,
  factories: SeederFactoryManager,
  signIn: SignIn,
): NewGroupReader {
  return async (profile = {}) => {
    const { id, authorization } = await signIn();
    await factories
      .get<ProfileEntity, ProfileFactoryMeta>(ProfileEntity)
      .setMeta({ ...profile, userId: id })
      .save();

    return readerOf(http, id, authorization);
  };
}

function arrangeParticipantsWith(factories: SeederFactoryManager): ArrangeParticipants {
  return async (hostSessionId, count, { sessionStatus, ...meta } = {}) => {
    const participantSessionIds: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const session = await factories
        .get<ReadingSessionEntity, ReadingSessionFactoryMeta>(ReadingSessionEntity)
        .setMeta(sessionStatus === undefined ? {} : { status: sessionStatus })
        .save();
      await factories
        .get<SessionParticipantEntity, SessionParticipantFactoryMeta>(SessionParticipantEntity)
        .setMeta({ ...meta, hostSessionId, participantSessionId: session.id })
        .save();
      participantSessionIds.push(session.id);
    }

    return participantSessionIds;
  };
}

export const test = integrationTest()
  .extend('newGroupReader', ({ http, factories, signIn }) =>
    newGroupReaderWith(http, factories, signIn),
  )
  .extend(
    'newWork',
    ({ factories }): NewWork =>
      async () =>
        (await factories.get(WorkEntity).save()).id,
  )
  .extend('arrangeParticipants', ({ factories }) => arrangeParticipantsWith(factories));

export interface StoredParticipation {
  readonly hostSessionId: string;
  readonly participantSessionId: string;
  readonly left: boolean;
  readonly removed: boolean;
}

export function storedParticipations(dataSource: DataSource): Promise<StoredParticipation[]> {
  return dataSource.query<StoredParticipation[]>(
    `SELECT host_session_id AS "hostSessionId",
            participant_session_id AS "participantSessionId",
            left_at IS NOT NULL AS "left",
            removed_at IS NOT NULL AS "removed"
     FROM reading.session_participants
     ORDER BY joined_at, participant_session_id`,
  );
}
