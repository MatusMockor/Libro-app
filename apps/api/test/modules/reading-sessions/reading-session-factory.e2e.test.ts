import { describe, expect } from 'vitest';
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
});
