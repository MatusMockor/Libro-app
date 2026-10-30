import { randomUUID } from 'node:crypto';
import type { Agent, Test } from 'supertest';
import type { DataSource } from 'typeorm';
import type { SeederFactoryManager } from 'typeorm-extension';
import { expect } from 'vitest';
import type { WorkFactoryMeta } from '../../../src/modules/books/factories/work.factory.js';
import { WorkEntity } from '../../../src/modules/books/persistence/work.entity.js';
import type { PostFactoryMeta } from '../../../src/modules/feed/factories/post.factory.js';
import type {
  PostPageResponse,
  PostResponse,
} from '../../../src/modules/feed/http/post.response.js';
import { PostEntity } from '../../../src/modules/feed/persistence/post.entity.js';
import type { ProfileFactoryMeta } from '../../../src/modules/profiles/factories/profile.factory.js';
import { ProfileEntity } from '../../../src/modules/profiles/persistence/profile.entity.js';
import { integrationTest } from '../../support/integration-test.js';
import { ProbeFeedSubscriberModule } from '../../support/probe-events/feed/probe-feed-subscriber.module.js';
import { ProbeEventRecorder } from '../../support/probe-events/subscriber/probe-event-recorder.js';
import type { SignedInUser, SignIn } from '../../support/sign-in.js';

export const POSTS_ROUTE = '/v1/posts';

export const FOLLOWING_ROUTE = '/v1/feed/following';

export const COMMUNITY_ROUTE = '/v1/feed/community';

export const postRoute = (postId: string): string => `${POSTS_ROUTE}/${postId}`;

export const likeRoute = (postId: string): string => `${postRoute(postId)}/like`;

export const reactionsRoute = (postId: string): string => `${postRoute(postId)}/reactions`;

export const reactionRoute = (postId: string, reaction: string): string =>
  `${reactionsRoute(postId)}/${reaction}`;

export interface Reader {
  readonly id: string;
  readonly authorization: string;
  get(path: string): Test;
  publish(body: object): Test;
  post(body?: object): Promise<PostResponse>;
  delete(postId: string): Test;
  like(postId: string): Test;
  unlike(postId: string): Test;
  react(postId: string, reaction: string): Test;
  unreact(postId: string, reaction: string): Test;
  follows(...readers: readonly { readonly id: string }[]): Promise<void>;
  page(path: string): Promise<PostPageResponse>;
  find(postId: string): Promise<PostResponse>;
}

export type NewReader = (profile?: ProfileFactoryMeta) => Promise<Reader>;

export function readerOf(http: Agent, { id, authorization }: SignedInUser): Reader {
  const authorized = (test: Test): Test => test.set('Authorization', authorization);
  const reader: Reader = {
    id,
    authorization,
    get: (path) => authorized(http.get(path)),
    publish: (body) => authorized(http.post(POSTS_ROUTE)).send(body),
    post: async (body = { text: 'Čítam a čítam.' }) => {
      const response = await reader.publish(body);
      expect(response.status, JSON.stringify(response.body)).toBe(201);

      return response.body as PostResponse;
    },
    delete: (postId) => authorized(http.delete(postRoute(postId))),
    like: (postId) => authorized(http.put(likeRoute(postId))),
    unlike: (postId) => authorized(http.delete(likeRoute(postId))),
    react: (postId, reaction) => authorized(http.put(reactionRoute(postId, reaction))),
    unreact: (postId, reaction) => authorized(http.delete(reactionRoute(postId, reaction))),
    follows: async (...readers) => {
      for (const followee of readers) {
        const response = await authorized(http.put(`/v1/profiles/${followee.id}/follow`));
        expect(response.status, `follow ${followee.id}`).toBe(204);
      }
    },
    page: async (path) => {
      const response = await reader.get(path);
      expect(response.status, `${path} ${JSON.stringify(response.body)}`).toBe(200);

      return response.body as PostPageResponse;
    },
    find: async (postId) => {
      const response = await reader.get(postRoute(postId));
      expect(response.status).toBe(200);

      return response.body as PostResponse;
    },
  };

  return reader;
}

function newReaderWith(http: Agent, factories: SeederFactoryManager, signIn: SignIn): NewReader {
  return async (profile = {}) => {
    const user = await signIn();
    await factories
      .get<ProfileEntity, ProfileFactoryMeta>(ProfileEntity)
      .setMeta({ ...profile, userId: user.id })
      .save();

    return readerOf(http, user);
  };
}

export function arrangeWork(
  factories: SeederFactoryManager,
  meta: WorkFactoryMeta = {},
): Promise<WorkEntity> {
  return factories.get<WorkEntity, WorkFactoryMeta>(WorkEntity).setMeta(meta).save();
}

export function arrangePost(
  factories: SeederFactoryManager,
  meta: PostFactoryMeta,
): Promise<PostEntity> {
  return factories.get<PostEntity, PostFactoryMeta>(PostEntity).setMeta(meta).save();
}

export async function arrangePosts(
  factories: SeederFactoryManager,
  dataSource: DataSource,
  metas: readonly PostFactoryMeta[],
): Promise<PostEntity[]> {
  const factory = factories.get<PostEntity, PostFactoryMeta>(PostEntity);
  const posts: PostEntity[] = [];
  for (const meta of metas) {
    posts.push(await factory.make(meta));
  }

  return dataSource.getRepository(PostEntity).save(posts, { chunk: 500 });
}

const PRECISE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

export async function arrangePostsAt(
  factories: SeederFactoryManager,
  dataSource: DataSource,
  authorId: string,
  times: readonly string[],
): Promise<string[]> {
  const factory = factories.get<PostEntity, PostFactoryMeta>(PostEntity);
  const ids: string[] = [];
  for (const time of times) {
    expect(time, 'a UTC time with microseconds').toMatch(PRECISE_TIME);
    const { text, workId, place } = await factory.make({ authorId });
    const id = randomUUID();
    await dataSource
      .getRepository(PostEntity)
      .insert({ id, authorId, text, workId, place, createdAt: () => `'${time}'::timestamptz` });
    ids.push(id);
  }

  return ids;
}

export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export function postIds({ items }: PostPageResponse): string[] {
  return items.map(({ id }) => id);
}

export const test = integrationTest({ imports: [ProbeFeedSubscriberModule] })
  .extend('newReader', ({ http, factories, signIn }) => newReaderWith(http, factories, signIn))
  .extend(
    'newReaderWithoutProfile',
    ({ http, signIn }) =>
      async () =>
        readerOf(http, await signIn()),
  )
  .extend('reader', ({ newReader }) => newReader())
  .extend('recorder', ({ app }) => {
    const recorder = app.get(ProbeEventRecorder);
    recorder.clear();

    return recorder;
  });
