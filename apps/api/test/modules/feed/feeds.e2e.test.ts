import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { describe, expect, vi } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { PostEntity } from '../../../src/modules/feed/persistence/post.entity.js';
import {
  arrangePost,
  arrangePosts,
  arrangeWork,
  COMMUNITY_ROUTE,
  FOLLOWING_ROUTE,
  hoursAgo,
  postIds,
  test,
  type Reader,
} from './feed.fixture.js';

const SAME_TIME = new Date('2026-10-01T10:00:00.000Z');

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function cursorOf(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

async function everyPage(reader: Reader, route: string, limit: number): Promise<string[]> {
  const seen: string[] = [];
  let cursor: string | null = null;
  for (let pages = 0; pages < 20; pages += 1) {
    const query: string = cursor === null ? '' : `&cursor=${cursor}`;
    const page = await reader.page(`${route}?limit=${String(limit)}${query}`);
    seen.push(...postIds(page));
    cursor = page.nextCursor;
    if (cursor === null) {
      return seen;
    }
  }

  return seen;
}

function newestFirst(posts: readonly PostEntity[]): string[] {
  return posts
    .toSorted(
      (left, right) =>
        right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id),
    )
    .map(({ id }) => id);
}

async function setCreatedAt(dataSource: DataSource, postId: string, at: string): Promise<void> {
  await dataSource.query('UPDATE feed.posts SET created_at = $2 WHERE id = $1', [postId, at]);
}

describe('GET /v1/feed/following', () => {
  test('lists the own posts and the posts of followed readers only, newest first', async ({
    reader,
    newReader,
    factories,
    dataSource,
  }) => {
    const jana = await newReader();
    const peter = await newReader();
    const stranger = await newReader();
    await reader.follows(jana, peter);
    const [own, janas, , peters] = await arrangePosts(factories, dataSource, [
      { authorId: reader.id, createdAt: hoursAgo(4) },
      { authorId: jana.id, createdAt: hoursAgo(3) },
      { authorId: stranger.id, createdAt: hoursAgo(2) },
      { authorId: peter.id, createdAt: hoursAgo(1) },
    ]);

    const page = await reader.page(FOLLOWING_ROUTE);

    expect(postIds(page)).toEqual([peters?.id, janas?.id, own?.id]);
    expect(page.nextCursor).toBeNull();
    expect(page.items.map(({ author }) => author?.followedByMe)).toEqual([true, true, false]);
  });

  test('lists only the own posts of a reader who follows nobody', async ({ reader, newReader }) => {
    const jana = await newReader();
    await jana.post();
    const own = await reader.post();

    expect(postIds(await reader.page(FOLLOWING_ROUTE))).toEqual([own.id]);
  });

  test('does not follow back automatically', async ({ reader, newReader }) => {
    const jana = await newReader();
    await jana.follows(reader);
    await jana.post();

    expect((await reader.page(FOLLOWING_ROUTE)).items).toEqual([]);
  });

  test('stops showing the posts of an unfollowed reader', async ({ reader, newReader, http }) => {
    const jana = await newReader();
    await reader.follows(jana);
    await jana.post();

    await http.delete(`/v1/profiles/${jana.id}/follow`).set('Authorization', reader.authorization);

    expect((await reader.page(FOLLOWING_ROUTE)).items).toEqual([]);
  });

  test('pages through every post exactly once', async ({
    reader,
    newReader,
    factories,
    dataSource,
  }) => {
    const jana = await newReader();
    await reader.follows(jana);
    const posts = await arrangePosts(
      factories,
      dataSource,
      Array.from({ length: 7 }, (_, index) => ({
        authorId: index % 2 === 0 ? reader.id : jana.id,
        createdAt: index < 4 ? SAME_TIME : hoursAgo(index),
      })),
    );

    expect(await everyPage(reader, FOLLOWING_ROUTE, 3)).toEqual(newestFirst(posts));
  });
});

describe('GET /v1/feed/community', () => {
  test('lists the posts of every reader, newest first', async ({
    reader,
    newReader,
    newReaderWithoutProfile,
    factories,
    dataSource,
  }) => {
    const jana = await newReader();
    const withoutProfile = await newReaderWithoutProfile();
    const posts = await arrangePosts(factories, dataSource, [
      { authorId: reader.id, createdAt: hoursAgo(3) },
      { authorId: jana.id, createdAt: hoursAgo(2) },
      { authorId: withoutProfile.id, createdAt: hoursAgo(1) },
    ]);

    const page = await jana.page(COMMUNITY_ROUTE);

    expect(postIds(page)).toEqual(newestFirst(posts));
    expect(page.items.map(({ author }) => author?.userId ?? null)).toEqual([
      null,
      jana.id,
      reader.id,
    ]);
  });

  test('orders posts with the same time by id and pages through them without gaps or repeats', async ({
    reader,
    factories,
    dataSource,
  }) => {
    const posts = await arrangePosts(
      factories,
      dataSource,
      Array.from({ length: 5 }, () => ({ authorId: reader.id, createdAt: SAME_TIME })),
    );

    const pagedOneByOne = await everyPage(reader, COMMUNITY_ROUTE, 1);
    const pagedByTwo = await everyPage(reader, COMMUNITY_ROUTE, 2);

    expect(pagedOneByOne).toEqual(
      posts
        .map(({ id }) => id)
        .toSorted()
        .toReversed(),
    );
    expect(pagedByTwo).toEqual(pagedOneByOne);
  });

  test('keeps microsecond precision in the cursor', async ({ reader, factories, dataSource }) => {
    const [first, second, third] = await arrangePosts(factories, dataSource, [
      { authorId: reader.id },
      { authorId: reader.id },
      { authorId: reader.id },
    ]);
    await setCreatedAt(dataSource, first?.id ?? '', '2026-10-01T10:00:00.000001Z');
    await setCreatedAt(dataSource, second?.id ?? '', '2026-10-01T10:00:00.000002Z');
    await setCreatedAt(dataSource, third?.id ?? '', '2026-10-01T10:00:00.000003Z');

    expect(await everyPage(reader, COMMUNITY_ROUTE, 1)).toEqual([third?.id, second?.id, first?.id]);
  });

  test('neither repeats nor skips posts when new ones arrive between pages', async ({
    reader,
    newReader,
    factories,
    dataSource,
  }) => {
    const jana = await newReader();
    const posts = await arrangePosts(
      factories,
      dataSource,
      [5, 4, 3, 2].map((hours) => ({ authorId: jana.id, createdAt: hoursAgo(hours) })),
    );

    const first = await reader.page(`${COMMUNITY_ROUTE}?limit=2`);
    await jana.post({ text: 'Nový príspevok' });
    const second = await reader.page(`${COMMUNITY_ROUTE}?limit=2&cursor=${first.nextCursor ?? ''}`);

    expect([...postIds(first), ...postIds(second)]).toEqual(newestFirst(posts));
    expect(second.nextCursor).toBeNull();
  });

  test('shows the book of a post and null for a work no longer in the catalogue', async ({
    reader,
    factories,
  }) => {
    const work = await arrangeWork(factories, { title: 'Proces', authors: ['Franz Kafka'] });
    await arrangePost(factories, {
      authorId: reader.id,
      workId: randomUUID(),
      createdAt: hoursAgo(2),
    });
    await arrangePost(factories, { authorId: reader.id, workId: work.id, createdAt: hoursAgo(1) });

    const page = await reader.page(COMMUNITY_ROUTE);

    expect(page.items.map(({ book }) => book?.title ?? null)).toEqual(['Proces', null]);
  });

  test('answers a page of 20 posts of 20 authors and books with as many queries as a page of 1', async ({
    reader,
    newReader,
    factories,
    dataSource,
  }) => {
    const metas = [];
    for (let made = 0; made < 21; made += 1) {
      const author = await newReader();
      const work = await arrangeWork(factories);
      await reader.follows(author);
      metas.push({ authorId: author.id, workId: work.id, createdAt: hoursAgo(made + 1) });
    }
    await arrangePosts(factories, dataSource, metas);
    const queries = vi.spyOn(dataSource.logger, 'logQuery');
    const countQueries = async (path: string, items: number): Promise<number> => {
      queries.mockClear();
      const page = await reader.page(path);
      expect(page.items).toHaveLength(items);
      expect(page.items.every(({ author, book }) => author !== null && book !== null)).toBe(true);

      return queries.mock.calls.length;
    };

    const counted = {
      communityOne: await countQueries(`${COMMUNITY_ROUTE}?limit=1`, 1),
      communityTwenty: await countQueries(`${COMMUNITY_ROUTE}?limit=20`, 20),
      followingOne: await countQueries(`${FOLLOWING_ROUTE}?limit=1`, 1),
      followingTwenty: await countQueries(`${FOLLOWING_ROUTE}?limit=20`, 20),
    };
    queries.mockRestore();

    expect(counted).toEqual({
      communityOne: 4,
      communityTwenty: 4,
      followingOne: 5,
      followingTwenty: 5,
    });
  });
});

describe('the feed pages', () => {
  const ROUTES = [FOLLOWING_ROUTE, COMMUNITY_ROUTE];

  test.for(ROUTES)('answers an empty first page on %s', async (route, { reader }) => {
    expect(await reader.page(route)).toStrictEqual({ items: [], nextCursor: null });
  });

  test.for(
    ROUTES.flatMap((route) =>
      [
        'limit=0',
        'limit=51',
        'limit=two',
        'cursor=',
        'cursor=nonsense',
        `cursor=${cursorOf({ createdAt: '2026-02-30T10:00:00.000000Z', id: randomUUID() })}`,
        `cursor=${cursorOf({ createdAt: '2026-10-01T10:00:00.000Z', id: randomUUID() })}`,
        `cursor=${cursorOf({ createdAt: '2026-10-01T10:00:00.000000Z', id: 'jana' })}`,
        `cursor=${cursorOf({ createdAt: '2026-10-01T10:00:00.000000Z' })}`,
        `cursor=${cursorOf({ createdAt: '2026-10-01T10:00:00.000000Z', id: randomUUID(), more: 1 })}`,
        `cursor=${cursorOf(['2026-10-01T10:00:00.000000Z', randomUUID()])}`,
        `cursor=${Buffer.from('{"createdAt":').toString('base64url')}`,
      ].map((query) => ({ route, query })),
    ),
  )('answers 400 validation_failed on $route?$query', async ({ route, query }, { reader }) => {
    const response = await reader.get(`${route}?${query}`);
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors?.map(({ path }) => path)).toEqual([query.split('=')[0]]);
  });

  test('answers 400 validation_failed for a cursor with a character outside base64url', async ({
    reader,
    factories,
    dataSource,
  }) => {
    await arrangePosts(
      factories,
      dataSource,
      [2, 1].map((hours) => ({ authorId: reader.id, createdAt: hoursAgo(hours) })),
    );
    const cursor = (await reader.page(`${COMMUNITY_ROUTE}?limit=1`)).nextCursor ?? '';

    const valid = await reader.get(`${COMMUNITY_ROUTE}?limit=1&cursor=${cursor}`);
    const appended = await reader.get(`${COMMUNITY_ROUTE}?limit=1&cursor=${cursor}!`);
    const padded = await reader.get(`${COMMUNITY_ROUTE}?limit=1&cursor=${cursor}%3D`);

    expect([valid.status, appended.status, padded.status]).toEqual([200, 400, 400]);
    for (const response of [appended, padded]) {
      expect((response.body as ProblemDetails).code).toBe('validation_failed');
      expect((response.body as ProblemDetails).errors?.map(({ path }) => path)).toEqual(['cursor']);
    }
  });

  test('answers 400 validation_failed for a cursor that is not encoded canonically', async ({
    reader,
  }) => {
    const json = `${JSON.stringify({ createdAt: '2026-10-01T10:00:00.000000Z', id: randomUUID() })} `;
    const canonical = Buffer.from(json).toString('base64url');
    const last = BASE64URL_ALPHABET.indexOf(canonical.slice(-1));
    const nonCanonical = `${canonical.slice(0, -1)}${BASE64URL_ALPHABET.charAt(last ^ 1)}`;

    const accepted = await reader.get(`${COMMUNITY_ROUTE}?cursor=${canonical}`);
    const rejected = await reader.get(`${COMMUNITY_ROUTE}?cursor=${nonCanonical}`);

    expect(Buffer.from(nonCanonical, 'base64url').toString()).toBe(json);
    expect([accepted.status, rejected.status]).toEqual([200, 400]);
    expect((rejected.body as ProblemDetails).errors?.map(({ path }) => path)).toEqual(['cursor']);
  });

  test('accepts a cursor of one feed in the other one', async ({
    reader,
    factories,
    dataSource,
  }) => {
    await arrangePosts(
      factories,
      dataSource,
      [3, 2, 1].map((hours) => ({ authorId: reader.id, createdAt: hoursAgo(hours) })),
    );

    const first = await reader.page(`${COMMUNITY_ROUTE}?limit=1`);
    const second = await reader.page(`${FOLLOWING_ROUTE}?limit=1&cursor=${first.nextCursor ?? ''}`);

    expect(second.items).toHaveLength(1);
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
  });

  test.for(ROUTES)(
    'answers 401 authentication_required without an access token on %s',
    async (route, { http }) => {
      const response = await http.get(route);

      expect(response.status).toBe(401);
      expect((response.body as ProblemDetails).code).toBe('authentication_required');
    },
  );
});
