import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import {
  codeOf,
  congratulationOfRoute,
  congratulationRoute,
  storedCongratulations,
  test,
} from './encouragements.fixture.js';

describe('PUT /v1/readings/:readingId/congratulation', () => {
  test('congratulates a followed reader on a finished reading', async ({
    reader,
    friend,
    dataSource,
  }) => {
    const reading = await reader.finishedReading();

    const response = await friend.put(congratulationRoute(reading.id));

    expect(response.status).toBe(204);
    expect(await storedCongratulations(dataSource)).toEqual([
      { readingId: reading.id, readerId: reader.id, authorId: friend.id },
    ]);
  });

  test('is idempotent: one row and one CongratulationAdded event', async ({
    reader,
    friend,
    dataSource,
    recorder,
  }) => {
    const reading = await reader.finishedReading();

    await friend.congratulate(reading.id);
    await friend.congratulate(reading.id);

    expect(await storedCongratulations(dataSource)).toHaveLength(1);
    expect(
      recorder.all().map(({ event }) => ({ name: event.name, version: event.version })),
    ).toEqual([{ name: 'CongratulationAdded', version: 1 }]);
    expect(recorder.all().map(({ event }) => event.payload)).toEqual([
      { readingId: reading.id, readerId: reader.id, authorId: friend.id },
    ]);
  });

  test('stores one congratulation and publishes once for concurrent requests', async ({
    reader,
    friend,
    dataSource,
    recorder,
  }) => {
    const reading = await reader.finishedReading();

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => friend.put(congratulationRoute(reading.id))),
    );

    expect(responses.map(({ status }) => status)).toEqual([204, 204, 204, 204, 204]);
    expect(await storedCongratulations(dataSource)).toHaveLength(1);
    expect(recorder.all()).toHaveLength(1);
  });

  test('keeps one congratulation per author and reading, not per book', async ({
    reader,
    friend,
    newMember,
    dataSource,
  }) => {
    const other = await newMember();
    await other.follows(reader);
    const [first, reread] = [await reader.finishedReading(), await reader.finishedReading()];

    await friend.congratulate(first.id);
    await friend.congratulate(reread.id);
    await other.congratulate(first.id);

    expect(await storedCongratulations(dataSource)).toHaveLength(3);
  });

  test('answers 409 reading_not_finished for a reading in progress', async ({
    reader,
    friend,
    dataSource,
  }) => {
    const reading = await reader.openReading();

    const response = await friend.put(congratulationRoute(reading.id));

    expect(response.status).toBe(409);
    expect(codeOf(response.body)).toBe('reading_not_finished');
    expect(await storedCongratulations(dataSource)).toEqual([]);
  });

  test('answers 409 cannot_encourage_own_reading for the own reading', async ({ reader }) => {
    const reading = await reader.finishedReading();

    const response = await reader.put(congratulationRoute(reading.id));

    expect(response.status).toBe(409);
    expect(codeOf(response.body)).toBe('cannot_encourage_own_reading');
  });

  test('answers 404 reading_not_found alike for a reader not followed and an unknown reading', async ({
    reader,
    newMember,
    dataSource,
    recorder,
  }) => {
    const stranger = await newMember();
    const reading = await reader.finishedReading();

    const notFollowed = await stranger.put(congratulationRoute(reading.id));
    const unknown = await stranger.put(congratulationRoute(randomUUID()));

    expect([notFollowed.status, unknown.status]).toEqual([404, 404]);
    expect([codeOf(notFollowed.body), codeOf(unknown.body)]).toEqual([
      'reading_not_found',
      'reading_not_found',
    ]);
    expect(await storedCongratulations(dataSource)).toEqual([]);
    expect(recorder.all()).toEqual([]);
  });
});

describe('DELETE /v1/readings/:readingId/congratulation', () => {
  test('withdraws the own congratulation and answers 204 again', async ({
    reader,
    friend,
    dataSource,
  }) => {
    const reading = await reader.finishedReading();
    await friend.congratulate(reading.id);

    const first = await friend.delete(congratulationRoute(reading.id));
    const again = await friend.delete(congratulationRoute(reading.id));

    expect([first.status, again.status]).toEqual([204, 204]);
    expect(await storedCongratulations(dataSource)).toEqual([]);
  });

  test('withdraws only the own congratulation', async ({
    reader,
    friend,
    newMember,
    dataSource,
  }) => {
    const other = await newMember();
    await other.follows(reader);
    const reading = await reader.finishedReading();
    await friend.congratulate(reading.id);

    expect((await other.delete(congratulationRoute(reading.id))).status).toBe(204);
    expect((await reader.delete(congratulationRoute(reading.id))).status).toBe(204);

    expect(await storedCongratulations(dataSource)).toHaveLength(1);
  });

  test('withdraws after the author unfollowed the reader', async ({
    reader,
    friend,
    dataSource,
  }) => {
    const reading = await reader.finishedReading();
    await friend.congratulate(reading.id);
    expect((await friend.delete(`/v1/profiles/${reader.id}/follow`)).status).toBe(204);

    expect((await friend.delete(congratulationRoute(reading.id))).status).toBe(204);
    expect(await storedCongratulations(dataSource)).toEqual([]);
  });
});

describe('DELETE /v1/readings/:readingId/congratulations/:authorId', () => {
  test('lets the reader remove a congratulation from the own reading, idempotently', async ({
    reader,
    friend,
    dataSource,
  }) => {
    const reading = await reader.finishedReading();
    await friend.congratulate(reading.id);

    const first = await reader.delete(congratulationOfRoute(reading.id, friend.id));
    const again = await reader.delete(congratulationOfRoute(reading.id, friend.id));

    expect([first.status, again.status]).toEqual([204, 204]);
    expect(await storedCongratulations(dataSource)).toEqual([]);
  });

  test('answers 404 reading_not_found for a reading of someone else or an unknown one', async ({
    reader,
    friend,
    newMember,
    dataSource,
  }) => {
    const other = await newMember();
    await other.follows(reader);
    const reading = await reader.finishedReading();
    await friend.congratulate(reading.id);

    const responses = await Promise.all([
      other.delete(congratulationOfRoute(reading.id, friend.id)),
      friend.delete(congratulationOfRoute(reading.id, friend.id)),
      reader.delete(congratulationOfRoute(randomUUID(), friend.id)),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([404, 404, 404]);
    expect(responses.map(({ body }) => codeOf(body))).toEqual([
      'reading_not_found',
      'reading_not_found',
      'reading_not_found',
    ]);
    expect(await storedCongratulations(dataSource)).toHaveLength(1);
  });
});
