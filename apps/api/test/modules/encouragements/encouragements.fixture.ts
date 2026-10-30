import type { Agent, Test } from 'supertest';
import type { DataSource } from 'typeorm';
import type { SeederFactoryManager } from 'typeorm-extension';
import { expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import { WorkEntity } from '../../../src/modules/books/persistence/work.entity.js';
import type { CongratulationFactoryMeta } from '../../../src/modules/encouragements/factories/congratulation.factory.js';
import type { InsightFactoryMeta } from '../../../src/modules/encouragements/factories/insight.factory.js';
import type {
  EncouragementPageResponse,
  InsightResponse,
} from '../../../src/modules/encouragements/http/encouragement.response.js';
import { CongratulationEntity } from '../../../src/modules/encouragements/persistence/congratulation.entity.js';
import { InsightEntity } from '../../../src/modules/encouragements/persistence/insight.entity.js';
import type { ProfileFactoryMeta } from '../../../src/modules/profiles/factories/profile.factory.js';
import { ProfileEntity } from '../../../src/modules/profiles/persistence/profile.entity.js';
import type { ReadingFactoryMeta } from '../../../src/modules/reading-sessions/factories/reading.factory.js';
import { ReadingEntity } from '../../../src/modules/reading-sessions/persistence/reading.entity.js';
import { integrationTest } from '../../support/integration-test.js';
import { ProbeEncouragementsSubscriberModule } from '../../support/probe-events/encouragements/probe-encouragements-subscriber.module.js';
import { ProbeEventRecorder } from '../../support/probe-events/subscriber/probe-event-recorder.js';
import type { SignIn } from '../../support/sign-in.js';

export const STARTED_AT = new Date('2026-01-01T08:00:00.000Z');

export const FINISHED_AT = new Date('2026-10-20T18:30:00.000Z');

export const insightsRoute = (readingId: string): string => `/v1/readings/${readingId}/insights`;

export const insightRoute = (insightId: string): string => `/v1/insights/${insightId}`;

export const congratulationRoute = (readingId: string): string =>
  `/v1/readings/${readingId}/congratulation`;

export const congratulationOfRoute = (readingId: string, authorId: string): string =>
  `/v1/readings/${readingId}/congratulations/${authorId}`;

export const encouragementsRoute = (readingId: string): string =>
  `/v1/readings/${readingId}/encouragements`;

export interface Member {
  readonly id: string;
  get(path: string): Test;
  put(path: string): Test;
  delete(path: string): Test;
  postInsight(readingId: string, body: object): Test;
  addInsight(readingId: string, text?: string): Promise<InsightResponse>;
  congratulate(readingId: string): Promise<void>;
  page(path: string): Promise<EncouragementPageResponse>;
  openReading(): Promise<ReadingEntity>;
  finishedReading(): Promise<ReadingEntity>;
  follows(...members: readonly { readonly id: string }[]): Promise<void>;
}

export type NewMember = (profile?: ProfileFactoryMeta) => Promise<Member>;

export interface StoredInsightRow {
  readonly readingId: string;
  readonly readerId: string;
  readonly authorId: string;
  readonly text: string;
}

export interface StoredCongratulationRow {
  readonly readingId: string;
  readonly readerId: string;
  readonly authorId: string;
}

export function codeOf(body: unknown): string | undefined {
  return (body as ProblemDetails).code;
}

export function errorsOf(body: unknown): { path: string; code: string }[] | undefined {
  return (body as ProblemDetails).errors?.map(({ path, code }) => ({ path, code }));
}

function memberOf(
  http: Agent,
  factories: SeederFactoryManager,
  { id, authorization }: { id: string; authorization: string },
): Member {
  const reading = async (finishedAt: Date | null): Promise<ReadingEntity> => {
    const work = await factories.get(WorkEntity).save();

    return factories
      .get<ReadingEntity, ReadingFactoryMeta>(ReadingEntity)
      .setMeta({ userId: id, workId: work.id, startedAt: STARTED_AT, finishedAt })
      .save();
  };
  const member: Member = {
    id,
    get: (path) => http.get(path).set('Authorization', authorization),
    put: (path) => http.put(path).set('Authorization', authorization),
    delete: (path) => http.delete(path).set('Authorization', authorization),
    postInsight: (readingId, body) =>
      http.post(insightsRoute(readingId)).set('Authorization', authorization).send(body),
    addInsight: async (readingId, text = 'Kapitola o mlyne ma dostala') => {
      const response = await member.postInsight(readingId, { text });
      expect(response.status, `POST ${insightsRoute(readingId)}`).toBe(201);

      return response.body as InsightResponse;
    },
    congratulate: async (readingId) => {
      const response = await member.put(congratulationRoute(readingId));
      expect(response.status, `PUT ${congratulationRoute(readingId)}`).toBe(204);
    },
    page: async (path) => {
      const response = await member.get(path);
      expect(response.status, `GET ${path}`).toBe(200);

      return response.body as EncouragementPageResponse;
    },
    openReading: () => reading(null),
    finishedReading: () => reading(FINISHED_AT),
    follows: async (...followees) => {
      for (const followee of followees) {
        const response = await http
          .put(`/v1/profiles/${followee.id}/follow`)
          .set('Authorization', authorization);
        expect(response.status, `follow ${followee.id}`).toBe(204);
      }
    },
  };

  return member;
}

function newMemberWith(http: Agent, factories: SeederFactoryManager, signIn: SignIn): NewMember {
  return async (profile = {}) => {
    const user = await signIn();
    await factories
      .get<ProfileEntity, ProfileFactoryMeta>(ProfileEntity)
      .setMeta({ ...profile, userId: user.id })
      .save();

    return memberOf(http, factories, user);
  };
}

export function arrangeInsight(
  factories: SeederFactoryManager,
  meta: InsightFactoryMeta,
): Promise<InsightEntity> {
  return factories.get<InsightEntity, InsightFactoryMeta>(InsightEntity).setMeta(meta).save();
}

export function arrangeCongratulation(
  factories: SeederFactoryManager,
  meta: CongratulationFactoryMeta,
): Promise<CongratulationEntity> {
  return factories
    .get<CongratulationEntity, CongratulationFactoryMeta>(CongratulationEntity)
    .setMeta(meta)
    .save();
}

export function storedInsights(dataSource: DataSource): Promise<StoredInsightRow[]> {
  return dataSource.query<StoredInsightRow[]>(
    `SELECT reading_id AS "readingId", reader_id AS "readerId", author_id AS "authorId", text
     FROM encouragements.insights
     ORDER BY created_at, id`,
  );
}

export function storedCongratulations(dataSource: DataSource): Promise<StoredCongratulationRow[]> {
  return dataSource.query<StoredCongratulationRow[]>(
    `SELECT reading_id AS "readingId", reader_id AS "readerId", author_id AS "authorId"
     FROM encouragements.congratulations
     ORDER BY created_at, author_id`,
  );
}

export const test = integrationTest({ imports: [ProbeEncouragementsSubscriberModule] })
  .extend('recorder', ({ app }) => {
    const recorder = app.get(ProbeEventRecorder);
    recorder.clear();

    return recorder;
  })
  .extend('newMember', ({ http, factories, signIn }) => newMemberWith(http, factories, signIn))
  .extend('reader', ({ newMember }) => newMember())
  .extend('friend', async ({ newMember, reader }) => {
    const friend = await newMember();
    await friend.follows(reader);

    return friend;
  });
