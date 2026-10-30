import { ConsoleLogger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { describe, expect, onTestFinished } from 'vitest';
import { EVENT_BUS, type EventBus } from '../../../src/events/event-bus.js';
import { UserDeleted } from '../../../src/modules/auth/index.js';
import { CapturingLogger } from '../../support/capturing-logger.js';
import { arrangeActivity, test } from './activity.fixture.js';

interface FeedRows {
  readonly posts: readonly string[];
  readonly likes: readonly string[];
  readonly reactions: readonly string[];
  readonly activities: readonly string[];
}

async function feedRows(dataSource: DataSource): Promise<FeedRows> {
  const [rows] = await dataSource.query<FeedRows[]>(
    `SELECT
       ARRAY(SELECT author_id::text FROM feed.posts ORDER BY author_id) AS posts,
       ARRAY(
         SELECT post.author_id || '<-' || l.user_id
         FROM feed.likes AS l JOIN feed.posts AS post ON post.id = l.post_id
         ORDER BY 1
       ) AS likes,
       ARRAY(
         SELECT post.author_id || '<-' || r.user_id || ':' || r.reaction
         FROM feed.reactions AS r JOIN feed.posts AS post ON post.id = r.post_id
         ORDER BY 1
       ) AS reactions,
       ARRAY(SELECT actor_id || ':' || kind FROM feed.activities ORDER BY 1) AS activities`,
  );

  return rows ?? { posts: [], likes: [], reactions: [], activities: [] };
}

describe('UserDeleted in the feed', () => {
  test('deletes the posts, activities, likes and reactions of the user, also on posts of others, idempotently', async ({
    app,
    dataSource,
    factories,
    newReader,
  }) => {
    const ann = await newReader();
    const ben = await newReader();
    const cleo = await newReader();
    const annsPost = await ann.post();
    const bensPost = await ben.post();
    await ann.post();
    await ben.like(annsPost.id);
    await ben.react(annsPost.id, 'heart');
    await ann.like(bensPost.id);
    await ann.react(bensPost.id, 'books');
    await ann.react(bensPost.id, 'hug');
    await cleo.like(bensPost.id);
    await cleo.react(bensPost.id, 'books');
    await arrangeActivity(factories, { actorId: ann.id, kind: 'reading_started' });
    await arrangeActivity(factories, { actorId: ann.id, kind: 'book_finished' });
    await arrangeActivity(factories, { actorId: ben.id, kind: 'book_finished' });
    const logger = new CapturingLogger();
    app.useLogger(logger);
    onTestFinished(() => {
      app.useLogger(new ConsoleLogger());
    });
    const events = app.get<EventBus>(EVENT_BUS);

    await events.publish(UserDeleted.create({ userId: ann.id }));
    const afterFirst = await feedRows(dataSource);
    await events.publish(UserDeleted.create({ userId: ann.id }));

    expect(logger.errors).toEqual([]);
    expect(afterFirst).toEqual({
      posts: [ben.id],
      likes: [`${ben.id}<-${cleo.id}`],
      reactions: [`${ben.id}<-${cleo.id}:books`],
      activities: [`${ben.id}:book_finished`, `${ben.id}:post`],
    });
    expect(await feedRows(dataSource)).toEqual(afterFirst);
    expect(await cleo.find(bensPost.id)).toMatchObject({
      likeCount: 1,
      reactions: [{ key: 'books', count: 1, reactedByMe: true }],
    });
    expect((await cleo.get(`/v1/posts/${annsPost.id}`)).status).toBe(404);
  });

  test('deletes nothing for a user without feed data', async ({
    app,
    dataSource,
    reader,
    newReader,
  }) => {
    const jana = await newReader();
    const post = await jana.post();
    await reader.like(post.id);
    const before = await feedRows(dataSource);

    await app
      .get<EventBus>(EVENT_BUS)
      .publish(UserDeleted.create({ userId: '00000000-0000-4000-8000-000000000999' }));

    expect(await feedRows(dataSource)).toEqual(before);
  });
});
