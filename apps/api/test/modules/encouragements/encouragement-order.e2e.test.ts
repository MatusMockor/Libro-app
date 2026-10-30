import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { InsightResponse } from '../../../src/modules/encouragements/http/encouragement.response.js';
import type { ReadingTreeResponse } from '../../../src/modules/tree/http/reading-tree.response.js';
import { requestsWaitingForSessionLock } from '../../support/session-lock.js';
import { arrangeCongratulation, test, type Member } from './encouragements.fixture.js';

const READING_LOCK_QUERY = "%hashtextextended('encouragements/'%";

const at = (minute: number): Date => new Date(Date.UTC(2026, 9, 1, 12, minute));

async function holdReadingLock(dataSource: DataSource, readingId: string) {
  const connection = dataSource.createQueryRunner();
  await connection.connect();
  await connection.startTransaction();
  await connection.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('encouragements/' || $1::text, 0))",
    [readingId],
  );

  return {
    release: async (): Promise<Date> => {
      const [{ now }] = (await connection.query('SELECT clock_timestamp() AS now')) as [
        { now: Date },
      ];
      await connection.commitTransaction();
      await connection.release();

      return now;
    },
  };
}

async function decorationIdsOf(reader: Member, readingId: string): Promise<string[]> {
  const response = await reader.get(`/v1/readings/${readingId}/tree`);
  expect(response.status).toBe(200);

  return (response.body as ReadingTreeResponse).tree.decorations.map(({ id }) => id);
}

describe('the order of encouragements on a reading', () => {
  test('appends encouragements in commit order, so the 100th decoration is never replaced', async ({
    reader,
    newMember,
    factories,
    dataSource,
  }) => {
    const [first, second] = [await newMember(), await newMember()];
    await first.follows(reader);
    await second.follows(reader);
    const reading = await reader.openReading();
    for (let minute = 0; minute < 99; minute += 1) {
      await arrangeCongratulation(factories, {
        readingId: reading.id,
        readerId: reader.id,
        createdAt: at(minute),
      });
    }
    const before = await decorationIdsOf(reader, reading.id);
    const lock = await holdReadingLock(dataSource, reading.id);

    const firstWrite = first.postInsight(reading.id, { text: 'First in line' }).then((r) => r);
    const firstWaiting = await requestsWaitingForSessionLock(dataSource, 1, READING_LOCK_QUERY);
    const secondWrite = second.postInsight(reading.id, { text: 'Second in line' }).then((r) => r);
    const bothWaiting = await requestsWaitingForSessionLock(dataSource, 2, READING_LOCK_QUERY);
    const releasedAt = await lock.release();
    const [firstResponse, secondResponse] = await Promise.all([firstWrite, secondWrite]);
    const [firstInsight, secondInsight] = [
      firstResponse.body as InsightResponse,
      secondResponse.body as InsightResponse,
    ];
    const after = await decorationIdsOf(reader, reading.id);

    expect({ firstWaiting, bothWaiting }).toEqual({ firstWaiting: 1, bothWaiting: 2 });
    expect([firstResponse.status, secondResponse.status]).toEqual([201, 201]);
    expect(Date.parse(firstInsight.createdAt)).toBeGreaterThanOrEqual(releasedAt.getTime());
    expect(Date.parse(secondInsight.createdAt)).toBeGreaterThanOrEqual(
      Date.parse(firstInsight.createdAt),
    );
    expect(before).toHaveLength(99);
    expect(after).toEqual([...before, `insight:${firstInsight.id}`]);
  });

  test('serialises congratulations on the reading behind the same lock', async ({
    reader,
    friend,
    dataSource,
  }) => {
    const reading = await reader.finishedReading();
    const lock = await holdReadingLock(dataSource, reading.id);

    const write = friend.put(`/v1/readings/${reading.id}/congratulation`).then((r) => r);
    const waiting = await requestsWaitingForSessionLock(dataSource, 1, READING_LOCK_QUERY);
    await lock.release();

    expect(waiting).toBe(1);
    expect((await write).status).toBe(204);
  });
});
