import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import { arrangePosts, hoursAgo, POSTS_ROUTE, test } from './feed.fixture.js';

const MAX_POSTS = 30;

const DAY_SECONDS = 24 * 60 * 60;

async function postCount(dataSource: DataSource, authorId: string): Promise<number> {
  const [row] = await dataSource.query<{ posts: number }[]>(
    'SELECT count(*)::int AS posts FROM feed.posts WHERE author_id = $1',
    [authorId],
  );

  return row?.posts ?? 0;
}

describe('the limit of 30 posts in 24 hours', () => {
  test('answers 429 post_limit_reached with Retry-After until the oldest counted post is a day old', async ({
    reader,
    factories,
    dataSource,
  }) => {
    await arrangePosts(
      factories,
      dataSource,
      Array.from({ length: MAX_POSTS }, (_, index) => ({
        authorId: reader.id,
        createdAt: hoursAgo(index === 0 ? 23 : 1),
      })),
    );

    const response = await reader.publish({ text: 'Ešte jeden' });
    const retryAfter = Number(response.headers['retry-after']);

    expect(response.status).toBe(429);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Too Many Requests',
      status: 429,
      detail: 'A reader can publish at most 30 posts in 24 hours; try again later.',
      instance: POSTS_ROUTE,
      code: 'post_limit_reached',
    });
    expect(retryAfter).toBeGreaterThan(3500);
    expect(retryAfter).toBeLessThanOrEqual(3600);
    expect(await postCount(dataSource, reader.id)).toBe(MAX_POSTS);
  });

  test('does not count posts older than 24 hours', async ({ reader, factories, dataSource }) => {
    await arrangePosts(
      factories,
      dataSource,
      Array.from({ length: MAX_POSTS }, (_, index) => ({
        authorId: reader.id,
        createdAt: hoursAgo(index === 0 ? 25 : 1),
      })),
    );

    const response = await reader.publish({ text: 'Ešte jeden' });

    expect(response.status).toBe(201);
    expect((await reader.publish({ text: 'A ďalší' })).status).toBe(429);
  });

  test('counts each reader on their own', async ({ reader, newReader, factories, dataSource }) => {
    const jana = await newReader();
    await arrangePosts(
      factories,
      dataSource,
      Array.from({ length: MAX_POSTS }, () => ({ authorId: jana.id, createdAt: hoursAgo(1) })),
    );

    expect((await reader.publish({ text: 'Ahoj' })).status).toBe(201);
    expect((await jana.publish({ text: 'Ahoj' })).status).toBe(429);
  });

  test('frees a place when a post is deleted', async ({ reader, factories, dataSource }) => {
    const [first] = await arrangePosts(
      factories,
      dataSource,
      Array.from({ length: MAX_POSTS }, () => ({ authorId: reader.id, createdAt: hoursAgo(1) })),
    );

    await reader.delete(first?.id ?? '');

    expect((await reader.publish({ text: 'Ahoj' })).status).toBe(201);
  });

  test('lets only one of two concurrent posts take the last place', async ({
    reader,
    factories,
    dataSource,
  }) => {
    await arrangePosts(
      factories,
      dataSource,
      Array.from({ length: MAX_POSTS - 1 }, () => ({
        authorId: reader.id,
        createdAt: hoursAgo(1),
      })),
    );

    const responses = await Promise.all([
      reader.publish({ text: 'Prvý' }),
      reader.publish({ text: 'Druhý' }),
      reader.publish({ text: 'Tretí' }),
    ]);

    expect(responses.map(({ status }) => status).toSorted()).toEqual([201, 429, 429]);
    expect(await postCount(dataSource, reader.id)).toBe(MAX_POSTS);
  });

  test('keeps Retry-After between 1 second and a day', async ({
    reader,
    factories,
    dataSource,
  }) => {
    await arrangePosts(
      factories,
      dataSource,
      Array.from({ length: MAX_POSTS }, () => ({ authorId: reader.id, createdAt: new Date() })),
    );

    const response = await reader.publish({ text: 'Ahoj' });
    const retryAfter = Number(response.headers['retry-after']);

    expect(response.status).toBe(429);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(DAY_SECONDS);
  });
});
