import { randomUUID } from 'node:crypto';
import type { DataSource, QueryRunner } from 'typeorm';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { ReactionPageResponse } from '../../../src/modules/feed/http/reaction.response.js';
import { ReactionEntity } from '../../../src/modules/feed/persistence/reaction.entity.js';
import type { ReactionFactoryMeta } from '../../../src/modules/feed/factories/reaction.factory.js';
import { requestsWaitingForSessionLock } from '../../support/session-lock.js';
import { likeRoute, reactionRoute, reactionsRoute, test, type Reader } from './feed.fixture.js';

async function reactionsOf(reader: Reader, path: string): Promise<ReactionPageResponse> {
  const response = await reader.get(path);
  expect(response.status, JSON.stringify(response.body)).toBe(200);

  return response.body as ReactionPageResponse;
}

const LOCKING_POST_QUERY = '%FOR KEY SHARE%';

async function deletingPost(dataSource: DataSource, postId: string): Promise<QueryRunner> {
  const connection = dataSource.createQueryRunner();
  await connection.connect();
  await connection.startTransaction();
  await connection.query('DELETE FROM feed.posts WHERE id = $1', [postId]);

  return connection;
}

async function storedLikes(dataSource: DataSource): Promise<number> {
  const [row] = await dataSource.query<{ likes: number }[]>(
    'SELECT count(*)::int AS likes FROM feed.likes',
  );

  return row?.likes ?? 0;
}

describe('PUT and DELETE /v1/posts/:postId/like', () => {
  test('likes the post once, also when liked again, and counts it', async ({
    reader,
    newReader,
    dataSource,
  }) => {
    const jana = await newReader();
    const post = await jana.post();

    const responses = [await reader.like(post.id), await reader.like(post.id)];
    await jana.like(post.id);

    expect(responses.map(({ status }) => status)).toEqual([204, 204]);
    expect(responses[0]?.body).toEqual({});
    expect(await storedLikes(dataSource)).toBe(2);
    expect(await reader.find(post.id)).toMatchObject({ likeCount: 2, likedByMe: true });
  });

  test('tells likedByMe for the viewer only', async ({ reader, newReader }) => {
    const jana = await newReader();
    const post = await jana.post();
    await jana.like(post.id);

    expect(await reader.find(post.id)).toMatchObject({ likeCount: 1, likedByMe: false });
    expect(await jana.find(post.id)).toMatchObject({ likeCount: 1, likedByMe: true });
  });

  test('unlikes the post, also when it was not liked', async ({ reader, newReader }) => {
    const jana = await newReader();
    const post = await jana.post();
    await reader.like(post.id);
    await jana.like(post.id);

    const responses = [await reader.unlike(post.id), await reader.unlike(post.id)];

    expect(responses.map(({ status }) => status)).toEqual([204, 204]);
    expect(await reader.find(post.id)).toMatchObject({ likeCount: 1, likedByMe: false });
  });

  test('lets two concurrent likes of the same reader count once', async ({ reader }) => {
    const post = await reader.post();

    const responses = await Promise.all([reader.like(post.id), reader.like(post.id)]);

    expect(responses.map(({ status }) => status)).toEqual([204, 204]);
    expect((await reader.find(post.id)).likeCount).toBe(1);
  });

  test('answers 404 post_not_found for a like that waited for a deletion of the post', async ({
    reader,
    dataSource,
  }) => {
    const post = await reader.post();
    const deletion = await deletingPost(dataSource, post.id);

    const like = reader.like(post.id).then((response) => response);
    const waiting = await requestsWaitingForSessionLock(dataSource, 1, LOCKING_POST_QUERY);
    await deletion.commitTransaction();
    await deletion.release();
    const response = await like;

    expect(waiting).toBe(1);
    expect(response.status).toBe(404);
    expect((response.body as ProblemDetails).code).toBe('post_not_found');
    expect(await storedLikes(dataSource)).toBe(0);
  });

  test('likes the post when a deletion it waited for was rolled back', async ({
    reader,
    dataSource,
  }) => {
    const post = await reader.post();
    const deletion = await deletingPost(dataSource, post.id);

    const like = reader.like(post.id).then((response) => response);
    const waiting = await requestsWaitingForSessionLock(dataSource, 1, LOCKING_POST_QUERY);
    await deletion.rollbackTransaction();
    await deletion.release();
    const response = await like;

    expect(waiting).toBe(1);
    expect(response.status).toBe(204);
    expect(await storedLikes(dataSource)).toBe(1);
  });

  test('answers 404 post_not_found for an unknown post', async ({ reader, dataSource }) => {
    const postId = randomUUID();

    const like = await reader.like(postId);
    const unlike = await reader.unlike(postId);

    expect([like.status, unlike.status]).toEqual([404, 404]);
    expect((like.body as ProblemDetails).code).toBe('post_not_found');
    expect(like.body).toMatchObject({ instance: likeRoute(postId) });
    expect((unlike.body as ProblemDetails).code).toBe('post_not_found');
    expect(await storedLikes(dataSource)).toBe(0);
  });

  test('answers 401 authentication_required without an access token', async ({ http, reader }) => {
    const post = await reader.post();

    const responses = [await http.put(likeRoute(post.id)), await http.delete(likeRoute(post.id))];

    expect(responses.map(({ status }) => status)).toEqual([401, 401]);
  });
});

describe('PUT and DELETE /v1/posts/:postId/reactions/:reaction', () => {
  test('adds each reaction once per reader and counts them in display order', async ({
    reader,
    newReader,
  }) => {
    const jana = await newReader();
    const peter = await newReader();
    const post = await jana.post();

    const responses = [
      await reader.react(post.id, 'books'),
      await reader.react(post.id, 'books'),
      await reader.react(post.id, 'heart'),
      await jana.react(post.id, 'books'),
      await peter.react(post.id, 'thinking'),
    ];

    expect(responses.map(({ status }) => status)).toEqual([204, 204, 204, 204, 204]);
    expect((await reader.find(post.id)).reactions).toStrictEqual([
      { key: 'heart', emoji: '❤️', count: 1, reactedByMe: true },
      { key: 'books', emoji: '📚', count: 2, reactedByMe: true },
      { key: 'thinking', emoji: '🤔', count: 1, reactedByMe: false },
    ]);
    expect((await jana.find(post.id)).reactions).toStrictEqual([
      { key: 'heart', emoji: '❤️', count: 1, reactedByMe: false },
      { key: 'books', emoji: '📚', count: 2, reactedByMe: true },
      { key: 'thinking', emoji: '🤔', count: 1, reactedByMe: false },
    ]);
  });

  test('removes one reaction, also when it was not there', async ({ reader }) => {
    const post = await reader.post();
    await reader.react(post.id, 'clap');
    await reader.react(post.id, 'hug');

    const responses = [
      await reader.unreact(post.id, 'clap'),
      await reader.unreact(post.id, 'clap'),
    ];

    expect(responses.map(({ status }) => status)).toEqual([204, 204]);
    expect((await reader.find(post.id)).reactions).toStrictEqual([
      { key: 'hug', emoji: '🤗', count: 1, reactedByMe: true },
    ]);
  });

  test('stores one reaction for two concurrent identical ones', async ({ reader, dataSource }) => {
    const post = await reader.post();

    const responses = await Promise.all([
      reader.react(post.id, 'heart'),
      reader.react(post.id, 'heart'),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([204, 204]);
    expect(await dataSource.query<unknown[]>('SELECT 1 FROM feed.reactions')).toHaveLength(1);
  });

  test('accepts every key of GET /v1/feed/reactions', async ({ reader }) => {
    const post = await reader.post();
    const response = await reader.get('/v1/feed/reactions');
    const { reactions } = response.body as { reactions: { key: string; emoji: string }[] };

    for (const { key } of reactions) {
      expect((await reader.react(post.id, key)).status, key).toBe(204);
    }

    expect(response.status).toBe(200);
    expect(reactions).toStrictEqual([
      { key: 'heart', emoji: '❤️' },
      { key: 'books', emoji: '📚' },
      { key: 'clap', emoji: '👏' },
      { key: 'wow', emoji: '😮' },
      { key: 'laugh', emoji: '😂' },
      { key: 'hug', emoji: '🤗' },
      { key: 'thinking', emoji: '🤔' },
    ]);
    expect((await reader.find(post.id)).reactions.map(({ key }) => key)).toEqual(
      reactions.map(({ key }) => key),
    );
  });

  test.for([
    { name: 'an unknown key', reaction: 'fire' },
    { name: 'a key in upper case', reaction: 'HEART' },
    { name: 'the emoji itself, URL-encoded', reaction: encodeURIComponent('❤️') },
    { name: 'a text comment', reaction: encodeURIComponent('pekne napisane') },
  ])('answers 400 validation_failed for $name', async ({ reaction }, { reader, dataSource }) => {
    const post = await reader.post();

    const added = await reader.react(post.id, reaction);
    const removed = await reader.unreact(post.id, reaction);

    expect([added.status, removed.status]).toEqual([400, 400]);
    expect((added.body as ProblemDetails).errors?.map(({ path }) => path)).toEqual(['reaction']);
    expect(await dataSource.query<unknown[]>('SELECT 1 FROM feed.reactions')).toEqual([]);
  });

  test('answers 404 post_not_found for an unknown post', async ({ reader }) => {
    const postId = randomUUID();

    const responses = [await reader.react(postId, 'heart'), await reader.unreact(postId, 'heart')];

    expect(responses.map(({ status }) => status)).toEqual([404, 404]);
    expect(responses[0]?.body).toMatchObject({
      code: 'post_not_found',
      instance: reactionRoute(postId, 'heart'),
    });
  });

  test('answers 401 authentication_required without an access token', async ({ http, reader }) => {
    const post = await reader.post();

    const responses = [
      await http.put(reactionRoute(post.id, 'heart')),
      await http.delete(reactionRoute(post.id, 'heart')),
    ];

    expect(responses.map(({ status }) => status)).toEqual([401, 401]);
  });
});

describe('GET /v1/posts/:postId/reactions', () => {
  test('lists who reacted with what, newest first', async ({ reader, newReader }) => {
    const jana = await newReader({ handle: 'jana', displayName: 'Jana' });
    const peter = await newReader({ handle: 'peter' });
    const post = await reader.post();
    await jana.react(post.id, 'heart');
    await peter.react(post.id, 'books');
    await jana.react(post.id, 'books');
    await reader.follows(jana);

    const page = await reactionsOf(reader, reactionsRoute(post.id));

    expect(page).toStrictEqual({
      items: [
        {
          userId: jana.id,
          user: {
            userId: jana.id,
            handle: 'jana',
            displayName: 'Jana',
            avatar: null,
            official: false,
            followedByMe: true,
          },
          key: 'books',
          emoji: '📚',
          createdAt: expect.any(String) as string,
        },
        {
          userId: peter.id,
          user: {
            userId: peter.id,
            handle: 'peter',
            displayName: null,
            avatar: null,
            official: false,
            followedByMe: false,
          },
          key: 'books',
          emoji: '📚',
          createdAt: expect.any(String) as string,
        },
        {
          userId: jana.id,
          user: {
            userId: jana.id,
            handle: 'jana',
            displayName: 'Jana',
            avatar: null,
            official: false,
            followedByMe: true,
          },
          key: 'heart',
          emoji: '❤️',
          createdAt: expect.any(String) as string,
        },
      ],
      nextCursor: null,
    });
  });

  test('pages through reactions with the same time in a stable order', async ({
    reader,
    newReader,
    factories,
  }) => {
    const post = await reader.post();
    const createdAt = new Date('2026-10-01T10:00:00.000Z');
    const reactors: Reader[] = [];
    for (let made = 0; made < 5; made += 1) {
      const reactor = await newReader();
      reactors.push(reactor);
      await factories
        .get<ReactionEntity, ReactionFactoryMeta>(ReactionEntity)
        .setMeta({ postId: post.id, userId: reactor.id, reaction: 'wow', createdAt })
        .save();
    }

    const seen: string[] = [];
    let cursor: string | null = '';
    for (let pages = 0; pages < 5 && cursor !== null; pages += 1) {
      const query: string = cursor === '' ? '' : `&cursor=${cursor}`;
      const page = await reactionsOf(reader, `${reactionsRoute(post.id)}?limit=2${query}`);
      seen.push(...page.items.map(({ userId }) => userId));
      cursor = page.nextCursor;
    }

    expect(seen.toSorted()).toEqual(reactors.map(({ id }) => id).toSorted());
    expect(new Set(seen).size).toBe(5);
    expect(cursor).toBeNull();
  });

  test('answers user null for a reader without a profile', async ({
    reader,
    newReaderWithoutProfile,
  }) => {
    const withoutProfile = await newReaderWithoutProfile();
    const post = await reader.post();
    await withoutProfile.react(post.id, 'laugh');

    const page = await reactionsOf(reader, reactionsRoute(post.id));

    expect(page.items).toMatchObject([{ userId: withoutProfile.id, user: null, key: 'laugh' }]);
  });

  test('answers 404 post_not_found for an unknown post', async ({ reader }) => {
    const response = await reader.get(reactionsRoute(randomUUID()));

    expect(response.status).toBe(404);
    expect((response.body as ProblemDetails).code).toBe('post_not_found');
  });

  test.for(['limit=0', 'limit=51', 'cursor=nonsense'])(
    'answers 400 validation_failed for %s',
    async (query, { reader }) => {
      const post = await reader.post();

      const response = await reader.get(`${reactionsRoute(post.id)}?${query}`);

      expect(response.status).toBe(400);
      expect((response.body as ProblemDetails).code).toBe('validation_failed');
    },
  );
});
