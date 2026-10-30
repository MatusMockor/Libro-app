import { describe, expect, vi } from 'vitest';
import { EVENT_BUS, type EventBus } from '../../../src/events/event-bus.js';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type {
  ActivityPageResponse,
  ActivityResponse,
} from '../../../src/modules/feed/http/activity.response.js';
import type { PostResponse } from '../../../src/modules/feed/http/post.response.js';
import { BookFinished, ReadingStarted } from '../../../src/modules/reading-sessions/index.js';
import {
  ACTIVITY_ROUTE,
  activityPage,
  arrangeActivity,
  arrangePhoto,
  arrangeReview,
  everyActivity,
  kindsOf,
  test,
} from './activity.fixture.js';
import { arrangePosts, hoursAgo } from './feed.fixture.js';

const SAME_TIME = new Date('2026-10-01T10:00:00.000Z');

function subjectsOf({ items }: ActivityPageResponse): (string | undefined)[] {
  return items.map(({ post, reading }) => post?.id ?? reading?.readingId);
}

function readingIdsOf(items: readonly ActivityResponse[]): (string | undefined)[] {
  return items.map(({ reading }) => reading?.readingId);
}

function withoutSignedUrls(post: PostResponse | null): unknown {
  return (
    post && {
      ...post,
      photos: post.photos.map((photo) => ({
        ...photo,
        variants: expect.any(Object) as unknown,
        urlsExpireAt: expect.any(String) as string,
      })),
    }
  );
}

describe('GET /v1/feed/activity', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.get(ACTIVITY_ROUTE);

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('shows a started and a finished book to the reader and the followers, newest first', async ({
    reader,
    newReader,
    readings,
    work,
  }) => {
    const jana = await newReader({ handle: 'jana', displayName: 'Jana' });
    const stranger = await newReader();
    await reader.follows(jana);
    const session = await readings.read(jana, work.id);

    const own = await activityPage(jana, 'type=reading');
    const followers = await activityPage(reader, 'type=reading');

    const reading = {
      readingId: session.readingId,
      book: {
        id: work.id,
        title: 'Proces',
        authors: [{ id: expect.any(String) as string, name: 'Franz Kafka' }],
      },
      review: null,
    };
    const item = (kind: string) => ({
      id: expect.any(String) as string,
      kind,
      actorId: jana.id,
      actor: expect.objectContaining({
        userId: jana.id,
        handle: 'jana',
        official: false,
      }) as unknown,
      createdAt: expect.any(String) as string,
      post: null,
      reading,
    });
    expect(own).toStrictEqual({
      items: [item('book_finished'), item('reading_started')],
      nextCursor: null,
    });
    expect(followers.items).toStrictEqual(
      own.items.map((ownItem) => ({
        ...ownItem,
        actor: { ...ownItem.actor, followedByMe: true },
      })),
    );
    expect((await activityPage(stranger, 'type=reading')).items).toEqual([]);
    expect((await activityPage(stranger, 'tab=community&type=all')).items).toEqual([]);
    expect((await activityPage(stranger, 'tab=community&type=reading')).items).toEqual([]);
  });

  test('hides the reading activity of a reader who shares it with nobody, also the older one, and shows it again', async ({
    reader,
    newReader,
    readings,
    work,
  }) => {
    const jana = await newReader();
    await reader.follows(jana);
    await readings.read(jana, work.id);

    await readings.shareReadingActivity(jana, 'nobody');
    const hidden = await activityPage(reader, 'type=reading');
    const ownWhileHidden = await activityPage(jana, 'type=reading');
    await readings.shareReadingActivity(jana, 'followers');
    const shown = await activityPage(reader, 'type=reading');

    expect(hidden.items).toEqual([]);
    expect(kindsOf(ownWhileHidden)).toEqual(['book_finished', 'reading_started']);
    expect(kindsOf(shown)).toEqual(['book_finished', 'reading_started']);
  });

  test('records reading_started when joining a group creates a new reading', async ({
    reader,
    newReader,
    readings,
    work,
  }) => {
    const host = await newReader();
    await reader.follows(host);
    const hostSession = await readings.start(host, work.id);

    const joined = await readings.join(reader, hostSession.id);
    const page = await activityPage(reader, 'type=reading');

    expect(page.items.map(({ kind, actorId }) => ({ kind, actorId }))).toEqual([
      { kind: 'reading_started', actorId: reader.id },
      { kind: 'reading_started', actorId: host.id },
    ]);
    expect(readingIdsOf(page.items)).toEqual([joined.readingId, hostSession.readingId]);
  });

  test('records nothing new when a session or a join attaches to an unfinished reading', async ({
    reader,
    newReader,
    readings,
    work,
  }) => {
    const host = await newReader();
    const first = await readings.start(reader, work.id);
    await readings.end(reader, first.id);
    const second = await readings.start(reader, work.id);
    await readings.end(reader, second.id);
    const hostSession = await readings.start(host, work.id);
    await reader.follows(host);

    const joined = await readings.join(reader, hostSession.id);
    const own = (await activityPage(reader, 'type=reading')).items.filter(
      ({ actorId }) => actorId === reader.id,
    );

    expect([second.readingId, joined.readingId]).toEqual([first.readingId, first.readingId]);
    expect(own.map(({ kind }) => kind)).toEqual(['reading_started']);
    expect(readingIdsOf(own)).toEqual([first.readingId]);
  });

  test('records a new reading_started for a re-read', async ({ reader, readings, work }) => {
    const first = await readings.read(reader, work.id);
    const second = await readings.read(reader, work.id);

    const page = await activityPage(reader, 'type=reading');

    expect(kindsOf(page)).toEqual([
      'book_finished',
      'reading_started',
      'book_finished',
      'reading_started',
    ]);
    expect(readingIdsOf(page.items)).toEqual([
      second.readingId,
      second.readingId,
      first.readingId,
      first.readingId,
    ]);
  });

  test('does not repeat an activity when its event is published again', async ({
    app,
    reader,
    readings,
    work,
  }) => {
    const session = await readings.read(reader, work.id);
    const before = await activityPage(reader);
    const payload = { readingId: session.readingId, userId: reader.id, workId: work.id };
    const events = app.get<EventBus>(EVENT_BUS);

    await events.publish(ReadingStarted.create(payload));
    await events.publish(BookFinished.create(payload));

    expect(await activityPage(reader)).toStrictEqual(before);
  });

  test('shows the own reading activity with actor null for a reader without a profile', async ({
    newReaderWithoutProfile,
    readings,
    work,
  }) => {
    const anonymous = await newReaderWithoutProfile();
    await readings.start(anonymous, work.id);

    const page = await activityPage(anonymous);

    expect(page.items.map(({ kind, actor }) => ({ kind, actor }))).toEqual([
      { kind: 'reading_started', actor: null },
    ]);
  });
});

describe('GET /v1/feed/activity filters', () => {
  test.for([
    { tab: 'following', type: 'posts', expected: ['friendsPost', 'ownPost'] },
    {
      tab: 'community',
      type: 'posts',
      expected: ['librosPost', 'strangersPost', 'friendsPost', 'ownPost'],
    },
    { tab: 'following', type: 'announcements', expected: ['librosPost'] },
    { tab: 'community', type: 'announcements', expected: ['librosPost'] },
    { tab: 'following', type: 'reading', expected: ['friendsReading', 'ownReading'] },
    { tab: 'community', type: 'reading', expected: ['friendsReading', 'ownReading'] },
    {
      tab: 'following',
      type: 'all',
      expected: ['friendsReading', 'ownReading', 'librosPost', 'friendsPost', 'ownPost'],
    },
    {
      tab: 'community',
      type: 'all',
      expected: [
        'friendsReading',
        'ownReading',
        'librosPost',
        'strangersPost',
        'friendsPost',
        'ownPost',
      ],
    },
  ])(
    'tab=$tab&type=$type lists exactly its activities',
    async ({ tab, type, expected }, { reader, newReader, factories, dataSource, work }) => {
      const friend = await newReader();
      const stranger = await newReader();
      const libro = await newReader({ handle: 'libro.club', official: true });
      await reader.follows(friend);
      const [ownPost, friendsPost, strangersPost, librosPost] = await arrangePosts(
        factories,
        dataSource,
        [reader, friend, stranger, libro].map((author, index) => ({
          authorId: author.id,
          createdAt: hoursAgo(10 - index),
        })),
      );
      const [ownReading, friendsReading] = await Promise.all(
        [reader, friend, stranger, libro].map((actor, index) =>
          arrangeActivity(factories, {
            actorId: actor.id,
            kind: index % 2 === 0 ? 'reading_started' : 'book_finished',
            workId: work.id,
            createdAt: hoursAgo(5 - index),
          }),
        ),
      );
      const subjects: Record<string, string | null | undefined> = {
        ownPost: ownPost?.id,
        friendsPost: friendsPost?.id,
        strangersPost: strangersPost?.id,
        librosPost: librosPost?.id,
        ownReading: ownReading?.readingId,
        friendsReading: friendsReading?.readingId,
      };

      const page = await activityPage(reader, `tab=${tab}&type=${type}`);

      expect(subjectsOf(page)).toEqual(expected.map((name) => subjects[name]));
    },
  );

  test('uses tab=following and type=all by default', async ({
    reader,
    newReader,
    readings,
    work,
  }) => {
    const stranger = await newReader();
    await stranger.post();
    const own = await reader.post();
    const session = await readings.start(reader, work.id);

    expect(subjectsOf(await activityPage(reader))).toEqual([session.readingId, own.id]);
  });

  test('shows announcements with the official badge to a reader who does not follow the account', async ({
    reader,
    newReader,
  }) => {
    const libro = await newReader({ handle: 'libro.club', official: true });
    const announcement = await libro.post({ text: 'Stretnutie v piatok' });

    const [following, community] = [
      await activityPage(reader, 'tab=following&type=all'),
      await activityPage(reader, 'tab=community&type=announcements'),
    ];

    for (const page of [following, community]) {
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({
        kind: 'post',
        actorId: libro.id,
        actor: { userId: libro.id, official: true, followedByMe: false },
        post: { id: announcement.id, author: { official: true } },
        reading: null,
      });
    }
  });

  test.for([
    { problem: 'an unknown tab', query: 'tab=friends', path: 'tab' },
    { problem: 'an unknown type', query: 'type=reviews', path: 'type' },
    { problem: 'an invalid cursor', query: 'cursor=not-a-cursor', path: 'cursor' },
    { problem: 'a limit over 50', query: 'limit=51', path: 'limit' },
  ])('answers 400 validation_failed for $problem', async ({ query, path }, { reader }) => {
    const response = await reader.get(`${ACTIVITY_ROUTE}?${query}`);
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors).toEqual([expect.objectContaining({ path })]);
  });
});

describe('GET /v1/feed/activity items', () => {
  test('carry a post exactly as GET /v1/posts/:postId answers it, with likes, reactions and photos', async ({
    reader,
    newReader,
    factories,
    work,
  }) => {
    const jana = await newReader({ handle: 'jana' });
    await reader.follows(jana);
    const photoId = await arrangePhoto(factories, jana.id);
    const posted = await jana.post({ text: 'Čítam Proces', workId: work.id, photoIds: [photoId] });
    await reader.like(posted.id);
    await reader.react(posted.id, 'books');

    const page = await activityPage(reader, 'type=posts');
    const post = await reader.find(posted.id);

    expect(page.items).toStrictEqual([
      {
        id: expect.any(String) as string,
        kind: 'post',
        actorId: jana.id,
        actor: post.author,
        createdAt: post.createdAt,
        post: withoutSignedUrls(post),
        reading: null,
      },
    ]);
    expect(post).toMatchObject({
      likeCount: 1,
      likedByMe: true,
      reactions: [{ key: 'books', count: 1, reactedByMe: true }],
      photos: [{ mediaId: photoId }],
    });
  });

  test('carry the rating, text and photo of the review on book_finished only', async ({
    reader,
    newReader,
    readings,
    factories,
    work,
  }) => {
    const jana = await newReader();
    await reader.follows(jana);
    const session = await readings.read(jana, work.id);
    const photoId = await arrangePhoto(factories, jana.id);
    await readings.review(jana, session.readingId, { rating: 4, text: 'Silné', photoId });

    const [finished, started] = (await activityPage(reader, 'type=reading')).items;

    expect(finished?.reading?.review).toStrictEqual({
      rating: 4,
      text: 'Silné',
      photo: {
        mediaId: photoId,
        width: expect.any(Number) as number,
        height: expect.any(Number) as number,
        variants: expect.any(Object) as unknown,
        urlsExpireAt: expect.any(String) as string,
      },
    });
    expect(started?.kind).toBe('reading_started');
    expect(started?.reading?.review).toBeNull();
  });

  test('carry a review without text or photo as nulls', async ({ reader, factories, work }) => {
    const finished = await arrangeActivity(factories, {
      actorId: reader.id,
      kind: 'book_finished',
      workId: work.id,
    });
    await arrangeReview(factories, {
      readingId: finished.readingId ?? '',
      userId: reader.id,
      workId: work.id,
      rating: 2,
      text: null,
      photoMediaId: null,
    });

    const [item] = (await activityPage(reader)).items;

    expect(item?.reading?.review).toStrictEqual({ rating: 2, text: null, photo: null });
  });

  test('disappear with their post', async ({ reader, dataSource }) => {
    const post = await reader.post();

    const [stored] = await dataSource.query<{ same: boolean }[]>(
      `SELECT activity.created_at = post.created_at AS same
       FROM feed.activities AS activity JOIN feed.posts AS post ON post.id = activity.post_id`,
    );
    await reader.delete(post.id).expect(204);

    expect(stored?.same).toBe(true);
    expect((await activityPage(reader)).items).toEqual([]);
    expect(await dataSource.query('SELECT 1 FROM feed.activities')).toEqual([]);
  });
});

describe('GET /v1/feed/activity pages', () => {
  test('page through mixed kinds with identical times exactly once, newest first', async ({
    reader,
    factories,
    dataSource,
    work,
  }) => {
    await arrangePosts(
      factories,
      dataSource,
      Array.from({ length: 5 }, (_, index) => ({
        authorId: reader.id,
        createdAt: index < 3 ? SAME_TIME : hoursAgo(index),
      })),
    );
    for (let index = 0; index < 4; index += 1) {
      await arrangeActivity(factories, {
        actorId: reader.id,
        kind: index % 2 === 0 ? 'reading_started' : 'book_finished',
        workId: work.id,
        createdAt: index < 2 ? SAME_TIME : hoursAgo(index + 5),
      });
    }
    const expected = (
      await dataSource.query<{ id: string }[]>(
        'SELECT id FROM feed.activities ORDER BY created_at DESC, id DESC',
      )
    ).map(({ id }) => id);

    const oneByOne = await everyActivity(reader, 'type=all', 1);
    const byThree = await everyActivity(reader, 'type=all', 3);

    expect(expected).toHaveLength(9);
    expect(oneByOne.map(({ id }) => id)).toEqual(expected);
    expect(byThree.map(({ id }) => id)).toEqual(expected);
  });

  test('cost the same number of queries whatever their size', async ({
    reader,
    newReader,
    readings,
    factories,
    dataSource,
    work,
  }) => {
    const jana = await newReader();
    await newReader({ official: true });
    await reader.follows(jana);
    for (let round = 0; round < 6; round += 1) {
      const session = await readings.read(jana, work.id);
      await readings.review(jana, session.readingId, {
        rating: 5,
        photoId: await arrangePhoto(factories, jana.id),
      });
      await jana.post({ text: `Post ${String(round)}`, workId: work.id });
    }
    const queries = vi.spyOn(dataSource.logger, 'logQuery');
    const countQueries = async (limit: number): Promise<number> => {
      queries.mockClear();
      const page = await activityPage(reader, `limit=${String(limit)}`);
      expect(new Set(kindsOf(page))).toEqual(new Set(['post', 'book_finished', 'reading_started']));
      expect(page.items).toHaveLength(limit);

      return queries.mock.calls.length;
    };

    const counted = { three: await countQueries(3), eighteen: await countQueries(18) };
    queries.mockRestore();

    expect(counted).toEqual({ three: 10, eighteen: 10 });
  });
});
