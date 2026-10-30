import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { PostResponse } from '../../../src/modules/feed/http/post.response.js';
import { arrangeWork, POSTS_ROUTE, test } from './feed.fixture.js';

interface StoredPostRow {
  readonly authorId: string;
  readonly text: string;
  readonly workId: string | null;
  readonly place: string | null;
}

function storedPosts(dataSource: DataSource): Promise<StoredPostRow[]> {
  return dataSource.query<StoredPostRow[]>(
    `SELECT author_id AS "authorId", text, work_id AS "workId", place
     FROM feed.posts
     ORDER BY created_at`,
  );
}

describe('POST /v1/posts', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.post(POSTS_ROUTE).send({ text: 'Ahoj' });

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('publishes a post about a book with a place', async ({ newReader, factories }) => {
    const jana = await newReader({ handle: 'jana', displayName: 'Jana' });
    const work = await arrangeWork(factories, {
      title: 'Malý princ',
      authors: ['Antoine de Saint-Exupéry'],
    });

    const response = await jana.publish({
      text: 'Práve som dočítala.',
      workId: work.id,
      place: 'kaviareň',
    });
    const post = response.body as PostResponse;

    expect(response.status).toBe(201);
    expect(post).toStrictEqual({
      id: expect.any(String) as string,
      authorId: jana.id,
      author: {
        userId: jana.id,
        handle: 'jana',
        displayName: 'Jana',
        avatar: null,
        official: false,
        followedByMe: false,
      },
      text: 'Práve som dočítala.',
      book: {
        id: work.id,
        title: 'Malý princ',
        authors: [{ id: expect.any(String) as string, name: 'Antoine de Saint-Exupéry' }],
      },
      place: 'kaviareň',
      createdAt: expect.any(String) as string,
      likeCount: 0,
      likedByMe: false,
      reactions: [],
      photos: [],
    });
    expect(Date.parse(post.createdAt)).toBeLessThanOrEqual(Date.now());
    expect(await jana.find(post.id)).toStrictEqual(post);
  });

  test('publishes a post with text only', async ({ reader, dataSource }) => {
    const post = await reader.post({ text: 'Len text.' });

    expect(post).toMatchObject({ text: 'Len text.', book: null, place: null });
    expect(await storedPosts(dataSource)).toEqual([
      { authorId: reader.id, text: 'Len text.', workId: null, place: null },
    ]);
  });

  test('trims the text and the place, normalises them to NFC and stores a blank place as null', async ({
    reader,
    dataSource,
  }) => {
    const first = await reader.post({
      text: '  Štastie\n'.normalize('NFD'),
      place: ' Žilina  '.normalize('NFD'),
    });
    const second = await reader.post({ text: 'Bez miesta', place: '   ' });
    const third = await reader.post({ text: 'Bez miesta', place: null });

    expect(first).toMatchObject({ text: 'Štastie', place: 'Žilina' });
    expect([second.place, third.place]).toEqual([null, null]);
    expect((await storedPosts(dataSource)).map(({ text, place }) => ({ text, place }))).toEqual([
      { text: 'Štastie', place: 'Žilina' },
      { text: 'Bez miesta', place: null },
      { text: 'Bez miesta', place: null },
    ]);
  });

  test('accepts 2000 characters counted in code points, also emoji', async ({ reader }) => {
    const post = await reader.post({ text: '📚'.repeat(2000), place: '🌳'.repeat(100) });

    expect(Array.from(post.text)).toHaveLength(2000);
    expect(Array.from(post.place ?? '')).toHaveLength(100);
  });

  test.for([
    { name: 'a missing text', body: {}, path: 'text' },
    { name: 'an empty text', body: { text: '' }, path: 'text' },
    { name: 'a blank text', body: { text: ' \n\t ' }, path: 'text' },
    { name: 'a text of 2001 code points', body: { text: '📚'.repeat(2001) }, path: 'text' },
    { name: 'a text that is not a string', body: { text: 42 }, path: 'text' },
    {
      name: 'a place of 101 code points',
      body: { text: 'Ahoj', place: 'a'.repeat(101) },
      path: 'place',
    },
    {
      name: 'a work id that is not a UUID',
      body: { text: 'Ahoj', workId: 'kafka' },
      path: 'workId',
    },
  ])('answers 400 validation_failed for $name', async ({ body, path }, { reader, dataSource }) => {
    const response = await reader.publish(body);
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors?.map((error) => error.path)).toEqual([path]);
    expect(await storedPosts(dataSource)).toEqual([]);
  });

  test.for([
    {
      name: 'a missing text',
      body: {},
      error: {
        message: 'Invalid input: expected string, received undefined',
        code: 'invalid_type',
      },
    },
    {
      name: 'a null text',
      body: { text: null },
      error: { message: 'Invalid input: expected string, received null', code: 'invalid_type' },
    },
    {
      name: 'an empty text',
      body: { text: '' },
      error: { message: 'Too small: expected string to have >=1 characters', code: 'too_small' },
    },
    {
      name: 'a blank text',
      body: { text: ' \n ', photoIds: [] },
      error: { message: 'Too small: expected string to have >=1 characters', code: 'too_small' },
    },
  ])('keeps the errors of a post without photos for $name', async ({ body, error }, { reader }) => {
    const response = await reader.publish(body);

    expect(response.status).toBe(400);
    expect((response.body as ProblemDetails).errors).toStrictEqual([{ path: 'text', ...error }]);
  });

  test('answers 400 validation_failed for a NUL character in the text', async ({ reader }) => {
    const response = await reader.publish({ text: 'Ahoj\u0000' });

    expect(response.status).toBe(400);
    expect((response.body as ProblemDetails).code).toBe('validation_failed');
  });

  test('answers 404 book_not_found for an unknown book', async ({ reader, dataSource }) => {
    const workId = randomUUID();

    const response = await reader.publish({ text: 'Ahoj', workId });

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: `No book with id ${workId} is in the catalogue.`,
      instance: POSTS_ROUTE,
      code: 'book_not_found',
    });
    expect(await storedPosts(dataSource)).toEqual([]);
  });

  test('accepts a work id in upper case', async ({ reader, factories }) => {
    const work = await arrangeWork(factories);

    const post = await reader.post({ text: 'Ahoj', workId: work.id.toUpperCase() });

    expect(post.book?.id).toBe(work.id);
  });

  test('strips fields the schema does not declare', async ({ reader, newReader }) => {
    const other = await newReader();

    const post = await reader.post({ text: 'Ahoj', authorId: other.id, photos: ['x'] });

    expect(post.authorId).toBe(reader.id);
    expect(post.photos).toEqual([]);
  });

  test('answers author null for an author without a profile', async ({
    newReaderWithoutProfile,
  }) => {
    const withoutProfile = await newReaderWithoutProfile();

    const post = await withoutProfile.post({ text: 'Ahoj' });

    expect(post).toMatchObject({ authorId: withoutProfile.id, author: null });
  });

  test('publishes PostCreated once with the ids of the post and its author', async ({
    reader,
    recorder,
  }) => {
    const post = await reader.post();

    expect(recorder.all()).toEqual([
      {
        handler: 'feed.v1',
        event: {
          name: 'PostCreated',
          version: 1,
          occurredAt: expect.any(Date) as Date,
          payload: { postId: post.id, authorId: reader.id },
        },
      },
    ]);
  });

  test('publishes no event for a rejected post', async ({ reader, recorder }) => {
    await reader.publish({ text: 'Ahoj', workId: randomUUID() });
    await reader.publish({ text: '' });

    expect(recorder.all()).toEqual([]);
  });
});
