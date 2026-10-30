import { describe, expect } from 'vitest';
import { EVENT_BUS, type EventBus } from '../../../src/events/event-bus.js';
import { UserDeleted } from '../../../src/modules/auth/index.js';
import { storedReviews, test } from './reviews.fixture.js';

describe('UserDeleted v1', () => {
  test("deletes every review of the user, idempotently, and keeps other readers' reviews", async ({
    app,
    reviewer,
    newReviewer,
    dataSource,
  }) => {
    const other = await newReviewer();
    const first = await reviewer.finishedReading();
    const reread = await reviewer.finishedReading({ workId: first.workId });
    await reviewer.review(first.id);
    await reviewer.review(reread.id);
    const theirs = await other.finishedReading({ workId: first.workId });
    await other.review(theirs.id, { rating: 5, text: 'Stays' });
    const events = app.get<EventBus>(EVENT_BUS);

    await events.publish(UserDeleted.create({ userId: reviewer.id }));
    const afterFirst = await storedReviews(dataSource);
    await events.publish(UserDeleted.create({ userId: reviewer.id }));

    expect(afterFirst).toEqual([
      { readingId: theirs.id, userId: other.id, workId: first.workId, rating: 5, text: 'Stays' },
    ]);
    expect(await storedReviews(dataSource)).toEqual(afterFirst);
  });
});
