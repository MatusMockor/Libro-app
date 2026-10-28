import { describe, expect, vi } from 'vitest';
import type { ReadingSessionFactoryMeta } from '../../../src/modules/reading-sessions/factories/reading-session.factory.js';
import { ReadingSessionEntity } from '../../../src/modules/reading-sessions/persistence/reading-session.entity.js';
import { test } from '../../support/integration-test.js';

describe('reading session factory', () => {
  test.for(['first', 'second'])(
    'starts the %s test from the same default reading and keeps them apart',
    async (_, { factories }) => {
      const sessions = factories.get<ReadingSessionEntity, ReadingSessionFactoryMeta>(
        ReadingSessionEntity,
      );

      const [first, second] = [await sessions.save(), await sessions.save()];

      expect(first.reading.userId).toBe('00000000-0000-4000-a000-000001000001');
      expect(second.reading.userId).toBe('00000000-0000-4000-a000-000001000002');
      expect(first.userId).toBe(first.reading.userId);
    },
  );

  test.for(['active', 'paused', 'ended'] as const)(
    'arranges a valid %s session',
    async (status, { factories }) => {
      const session = await factories
        .get<ReadingSessionEntity, ReadingSessionFactoryMeta>(ReadingSessionEntity)
        .setMeta({ status })
        .save();

      expect(session.status).toBe(status);
      expect(session.activeSince === null).toBe(status !== 'active');
      expect(session.endedAt === null).toBe(status !== 'ended');
    },
  );

  test('arranges the checkpoints and marked parts of a session in one insert each', async ({
    factories,
    dataSource,
  }) => {
    const sessions = factories.get<ReadingSessionEntity, ReadingSessionFactoryMeta>(
      ReadingSessionEntity,
    );
    const queries = vi.spyOn(dataSource.logger, 'logQuery');

    const session = await sessions
      .setMeta({
        checkpointPages: Array.from({ length: 500 }, (_, index) => index + 1),
        markedParts: [
          { kind: 'good', fromPage: 1, toPage: 10 },
          { kind: 'skipped', fromPage: 11, toPage: 12 },
        ],
      })
      .save();
    const inserts = queries.mock.calls
      .map(([query]) => /^INSERT INTO "reading"\."(\w+)"/.exec(query)?.[1])
      .filter((table) => table !== undefined);
    queries.mockRestore();
    const [stored] = await dataSource.query<{ checkpoints: number; markedParts: number }[]>(
      `SELECT (SELECT count(*)::int FROM reading.checkpoints WHERE session_id = $1) AS checkpoints,
              (SELECT count(*)::int FROM reading.marked_parts WHERE session_id = $1) AS "markedParts"`,
      [session.id],
    );

    expect(inserts.toSorted()).toEqual(['checkpoints', 'marked_parts', 'readings', 'sessions']);
    expect(stored).toEqual({ checkpoints: 500, markedParts: 2 });
  });
});
