import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import { MediaFileEntity } from '../../../src/modules/media/persistence/media-file.entity.js';
import {
  arrangePosts,
  arrangeWork,
  hoursAgo,
  postIds,
  postRoute,
  POSTS_ROUTE,
  test,
} from './feed.fixture.js';

async function tableSizes(dataSource: DataSource): Promise<Record<string, number>> {
  const [sizes] = await dataSource.query<Record<string, number>[]>(
    `SELECT (SELECT count(*)::int FROM feed.posts) AS posts,
            (SELECT count(*)::int FROM feed.likes) AS likes,
            (SELECT count(*)::int FROM feed.reactions) AS reactions`,
  );

  return sizes ?? {};
}

describe('GET /v1/posts/:postId', () => {
  test('answers the post to every signed-in reader, with the viewer in followedByMe', async ({
    reader,
    newReader,
  }) => {
    const jana = await newReader({ handle: 'jana' });
    const post = await jana.post({ text: 'Ahoj všetci' });
    await reader.follows(jana);

    const seen = await reader.find(post.id);

    expect(seen).toStrictEqual({
      ...post,
      author: { ...post.author, followedByMe: true },
    });
  });

  test('shows the avatar of the author', async ({ newReader, factories }) => {
    const media = await factories.get(MediaFileEntity).save();
    const jana = await newReader({ avatarMediaId: media.id });

    const post = await jana.post();

    expect(post.author?.avatar?.variants.small).toEqual({
      url: expect.stringMatching(/^http:\/\/media\.test\/v1\/media\/files\//) as string,
      width: 256,
      height: 192,
    });
  });

  test('answers 404 post_not_found for an unknown post', async ({ reader }) => {
    const postId = randomUUID();

    const response = await reader.get(postRoute(postId));

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'No such post was found.',
      instance: postRoute(postId),
      code: 'post_not_found',
    });
  });

  test('accepts the id in upper case', async ({ reader }) => {
    const post = await reader.post();

    const response = await reader.get(postRoute(post.id.toUpperCase()));

    expect(response.status).toBe(200);
  });

  test('answers 400 validation_failed for an id that is not a UUID', async ({ reader }) => {
    const response = await reader.get(postRoute('first'));

    expect(response.status).toBe(400);
    expect((response.body as ProblemDetails).code).toBe('validation_failed');
  });

  test('answers 401 authentication_required without an access token', async ({ http, reader }) => {
    const post = await reader.post();

    const response = await http.get(postRoute(post.id));

    expect(response.status).toBe(401);
  });
});

describe('DELETE /v1/posts/:postId', () => {
  test('deletes the own post with its likes and reactions', async ({
    reader,
    newReader,
    dataSource,
  }) => {
    const jana = await newReader();
    const post = await reader.post();
    const kept = await reader.post();
    await jana.like(post.id);
    await jana.react(post.id, 'heart');
    await jana.like(kept.id);

    const response = await reader.delete(post.id);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect((await reader.get(postRoute(post.id))).status).toBe(404);
    expect(await tableSizes(dataSource)).toEqual({ posts: 1, likes: 1, reactions: 0 });
  });

  test('answers 404 post_not_found for the post of another reader and keeps it', async ({
    reader,
    newReader,
  }) => {
    const jana = await newReader();
    const post = await jana.post();

    const response = await reader.delete(post.id);

    expect(response.status).toBe(404);
    expect((response.body as ProblemDetails).code).toBe('post_not_found');
    expect((await reader.get(postRoute(post.id))).status).toBe(200);
  });

  test('answers 404 post_not_found for an unknown or already deleted post', async ({ reader }) => {
    const post = await reader.post();
    await reader.delete(post.id);

    const responses = [await reader.delete(post.id), await reader.delete(randomUUID())];

    expect(responses.map(({ status }) => status)).toEqual([404, 404]);
  });

  test('answers 401 authentication_required without an access token', async ({ http, reader }) => {
    const post = await reader.post();

    const response = await http.delete(postRoute(post.id));

    expect(response.status).toBe(401);
  });
});

describe('GET /v1/posts?authorId=', () => {
  test('lists the posts of one reader, newest first', async ({
    reader,
    newReader,
    factories,
    dataSource,
  }) => {
    const jana = await newReader();
    const [older, newer] = await arrangePosts(factories, dataSource, [
      { authorId: jana.id, createdAt: hoursAgo(2) },
      { authorId: jana.id, createdAt: hoursAgo(1) },
      { authorId: reader.id, createdAt: hoursAgo(1) },
    ]);

    const page = await reader.page(`${POSTS_ROUTE}?authorId=${jana.id}`);

    expect(postIds(page)).toEqual([newer?.id, older?.id]);
    expect(page.nextCursor).toBeNull();
  });

  test('answers an empty page for a reader without posts or an unknown id', async ({ reader }) => {
    await reader.post();

    expect(await reader.page(`${POSTS_ROUTE}?authorId=${randomUUID()}`)).toStrictEqual({
      items: [],
      nextCursor: null,
    });
  });

  test('pages through the posts', async ({ reader, factories, dataSource }) => {
    const work = await arrangeWork(factories);
    await arrangePosts(
      factories,
      dataSource,
      [3, 2, 1].map((hours) => ({
        authorId: reader.id,
        workId: work.id,
        createdAt: hoursAgo(hours),
      })),
    );

    const first = await reader.page(`${POSTS_ROUTE}?authorId=${reader.id}&limit=2`);
    const second = await reader.page(
      `${POSTS_ROUTE}?authorId=${reader.id}&limit=2&cursor=${first.nextCursor ?? ''}`,
    );

    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(second.items[0]?.book?.id).toBe(work.id);
  });

  test.for(['', 'authorId=jana', `authorId=${randomUUID()}&limit=0`])(
    'answers 400 validation_failed for "%s"',
    async (query, { reader }) => {
      const response = await reader.get(`${POSTS_ROUTE}?${query}`);

      expect(response.status).toBe(400);
      expect((response.body as ProblemDetails).code).toBe('validation_failed');
    },
  );
});
