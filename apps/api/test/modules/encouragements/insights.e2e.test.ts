import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import type { InsightResponse } from '../../../src/modules/encouragements/http/encouragement.response.js';
import { codeOf, errorsOf, insightRoute, storedInsights, test } from './encouragements.fixture.js';

const COMBINING_ACUTE = '́';

describe('POST /v1/readings/:readingId/insights', () => {
  test('adds the insight of a follower to a reading in progress and answers it', async ({
    reader,
    friend,
    dataSource,
  }) => {
    const reading = await reader.openReading();

    const response = await friend.postInsight(reading.id, { text: 'Kapitola o mlyne ma dostala' });
    const insight = response.body as InsightResponse;

    expect(response.status).toBe(201);
    expect(insight).toStrictEqual({
      id: expect.any(String) as unknown,
      readingId: reading.id,
      decorationId: `insight:${insight.id}`,
      authorId: friend.id,
      author: expect.objectContaining({ userId: friend.id, followedByMe: false }) as unknown,
      text: 'Kapitola o mlyne ma dostala',
      createdAt: expect.any(String) as unknown,
    });
    expect(await storedInsights(dataSource)).toEqual([
      {
        readingId: reading.id,
        readerId: reader.id,
        authorId: friend.id,
        text: 'Kapitola o mlyne ma dostala',
      },
    ]);
  });

  test('publishes InsightAdded once, after the insight was stored', async ({
    reader,
    friend,
    recorder,
  }) => {
    const reading = await reader.openReading();

    const insight = await friend.addInsight(reading.id);

    expect(
      recorder.all().map(({ event }) => ({ name: event.name, version: event.version })),
    ).toEqual([{ name: 'InsightAdded', version: 1 }]);
    expect(recorder.all().map(({ event }) => event.payload)).toEqual([
      { insightId: insight.id, readingId: reading.id, readerId: reader.id, authorId: friend.id },
    ]);
  });

  test('answers 404 reading_not_found alike for a reader not followed and an unknown reading', async ({
    reader,
    newMember,
    dataSource,
    recorder,
  }) => {
    const stranger = await newMember();
    const reading = await reader.openReading();

    const notFollowed = await stranger.postInsight(reading.id, { text: 'Hi' });
    const unknown = await stranger.postInsight(randomUUID(), { text: 'Hi' });

    expect([notFollowed.status, unknown.status]).toEqual([404, 404]);
    expect(notFollowed.body).toStrictEqual({
      ...(unknown.body as object),
      instance: expect.any(String) as unknown,
    });
    expect(codeOf(notFollowed.body)).toBe('reading_not_found');
    expect(await storedInsights(dataSource)).toEqual([]);
    expect(recorder.all()).toEqual([]);
  });

  test('answers 404 after the author unfollowed the reader', async ({ reader, friend }) => {
    const reading = await reader.openReading();
    const unfollowed = await friend.delete(`/v1/profiles/${reader.id}/follow`);
    expect(unfollowed.status).toBe(204);

    const response = await friend.postInsight(reading.id, { text: 'Still here?' });

    expect(response.status).toBe(404);
    expect(codeOf(response.body)).toBe('reading_not_found');
  });

  test('answers 409 cannot_encourage_own_reading for the own reading', async ({
    reader,
    dataSource,
  }) => {
    const reading = await reader.openReading();

    const response = await reader.postInsight(reading.id, { text: 'Note to self' });

    expect(response.status).toBe(409);
    expect(codeOf(response.body)).toBe('cannot_encourage_own_reading');
    expect(await storedInsights(dataSource)).toEqual([]);
  });

  test('answers 409 reading_finished for a finished reading', async ({
    reader,
    friend,
    dataSource,
  }) => {
    const reading = await reader.finishedReading();

    const response = await friend.postInsight(reading.id, { text: 'Too late' });

    expect(response.status).toBe(409);
    expect(codeOf(response.body)).toBe('reading_finished');
    expect(await storedInsights(dataSource)).toEqual([]);
  });

  test('trims the text and normalises it to NFC', async ({ reader, friend }) => {
    const reading = await reader.openReading();

    const insight = await friend.addInsight(reading.id, `  Kra${COMBINING_ACUTE}sne  `);

    expect(insight.text).toBe('Krásne');
  });

  test('accepts 300 characters counted in Unicode code points', async ({ reader, friend }) => {
    const reading = await reader.openReading();
    const text = '📚'.repeat(300);

    expect((await friend.addInsight(reading.id, text)).text).toBe(text);
  });

  test.for([
    ['301 characters', { text: '📚'.repeat(301) }, 'too_big'],
    ['blank text', { text: ' \n\t ' }, 'too_small'],
    ['empty text', { text: '' }, 'too_small'],
    ['no text', {}, 'invalid_type'],
    ['a number', { text: 7 }, 'invalid_type'],
  ] as const)(
    'answers 400 validation_failed for %s',
    async ([, body, code], { reader, friend, dataSource }) => {
      const reading = await reader.openReading();

      const response = await friend.postInsight(reading.id, body);

      expect(response.status).toBe(400);
      expect(codeOf(response.body)).toBe('validation_failed');
      expect(errorsOf(response.body)).toEqual([{ path: 'text', code }]);
      expect(await storedInsights(dataSource)).toEqual([]);
    },
  );

  test('answers 400 validation_failed for a reading id that is not a UUID', async ({ friend }) => {
    const response = await friend.postInsight('not-a-uuid', { text: 'Hi' });

    expect(response.status).toBe(400);
    expect(errorsOf(response.body)).toEqual([{ path: 'readingId', code: 'invalid_format' }]);
  });

  test('accepts the reading id in upper case', async ({ reader, friend }) => {
    const reading = await reader.openReading();

    const insight = await friend.addInsight(reading.id.toUpperCase());

    expect(insight.readingId).toBe(reading.id);
  });
});

describe('the insight limit', () => {
  test('allows 3 insights per author and reading, then answers 409 insight_limit_reached', async ({
    reader,
    friend,
    dataSource,
    recorder,
  }) => {
    const reading = await reader.openReading();
    for (const text of ['One', 'Two', 'Three']) {
      await friend.addInsight(reading.id, text);
    }

    const fourth = await friend.postInsight(reading.id, { text: 'Four' });

    expect(fourth.status).toBe(409);
    expect(codeOf(fourth.body)).toBe('insight_limit_reached');
    expect((await storedInsights(dataSource)).map(({ text }) => text)).toEqual([
      'One',
      'Two',
      'Three',
    ]);
    expect(recorder.all()).toHaveLength(3);
  });

  test('counts per reading and per author', async ({ reader, friend, newMember }) => {
    const other = await newMember();
    await other.follows(reader);
    const [first, second] = [await reader.openReading(), await reader.openReading()];
    for (const text of ['One', 'Two', 'Three']) {
      await friend.addInsight(first.id, text);
    }

    const onAnotherReading = await friend.postInsight(second.id, { text: 'Elsewhere' });
    const byAnotherAuthor = await other.postInsight(first.id, { text: 'Mine' });

    expect([onAnotherReading.status, byAnotherAuthor.status]).toEqual([201, 201]);
  });

  test('frees a place when an insight is deleted', async ({ reader, friend }) => {
    const reading = await reader.openReading();
    const [first] = [
      await friend.addInsight(reading.id, 'One'),
      await friend.addInsight(reading.id, 'Two'),
      await friend.addInsight(reading.id, 'Three'),
    ];
    expect((await friend.delete(insightRoute(first.id))).status).toBe(204);

    const response = await friend.postInsight(reading.id, { text: 'Four' });

    expect(response.status).toBe(201);
  });

  test('never stores more than 3 insights of concurrent requests', async ({
    reader,
    friend,
    dataSource,
    recorder,
  }) => {
    const reading = await reader.openReading();

    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        friend.postInsight(reading.id, { text: `Insight ${String(index)}` }),
      ),
    );

    expect(responses.map(({ status }) => status).sort()).toEqual([
      201, 201, 201, 409, 409, 409, 409, 409,
    ]);
    expect(await storedInsights(dataSource)).toHaveLength(3);
    expect(recorder.all()).toHaveLength(3);
  });
});

describe('DELETE /v1/insights/:insightId', () => {
  test('deletes the insight for its author', async ({ reader, friend, dataSource }) => {
    const insight = await friend.addInsight((await reader.openReading()).id);

    const response = await friend.delete(insightRoute(insight.id));

    expect(response.status).toBe(204);
    expect(await storedInsights(dataSource)).toEqual([]);
  });

  test('deletes the insight for the reader whose reading it is on', async ({
    reader,
    friend,
    dataSource,
  }) => {
    const insight = await friend.addInsight((await reader.openReading()).id);

    const response = await reader.delete(insightRoute(insight.id));

    expect(response.status).toBe(204);
    expect(await storedInsights(dataSource)).toEqual([]);
  });

  test('answers 404 insight_not_found for anyone else, an unknown and a deleted insight', async ({
    reader,
    friend,
    newMember,
    dataSource,
  }) => {
    const other = await newMember();
    await other.follows(reader);
    const insight = await friend.addInsight((await reader.openReading()).id);
    const deleted = await friend.addInsight((await reader.openReading()).id);
    expect((await friend.delete(insightRoute(deleted.id))).status).toBe(204);

    const responses = await Promise.all([
      other.delete(insightRoute(insight.id)),
      other.delete(insightRoute(randomUUID())),
      friend.delete(insightRoute(deleted.id)),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([404, 404, 404]);
    expect(responses.map(({ body }) => codeOf(body))).toEqual([
      'insight_not_found',
      'insight_not_found',
      'insight_not_found',
    ]);
    expect(await storedInsights(dataSource)).toHaveLength(1);
  });
});
