import type { INestApplication } from '@nestjs/common';
import { describe, expect } from 'vitest';
import { EVENT_BUS, type EventBus } from '../../../src/events/event-bus.js';
import { UserDeleted } from '../../../src/modules/auth/index.js';
import {
  arrangeCongratulation,
  arrangeInsight,
  storedCongratulations,
  storedInsights,
  test,
} from './encouragements.fixture.js';

const ANN = '00000000-0000-4000-8000-0000000000a1';

const BEN = '00000000-0000-4000-8000-0000000000b2';

const CID = '00000000-0000-4000-8000-0000000000c3';

const ANNS_READING = '00000000-0000-4000-8000-00000000a001';

const BENS_READING = '00000000-0000-4000-8000-00000000b001';

const CIDS_READING = '00000000-0000-4000-8000-00000000c001';

function erase(app: INestApplication, userId: string): Promise<void> {
  return app.get<EventBus>(EVENT_BUS).publish(UserDeleted.create({ userId }));
}

describe('erasing the encouragements of a deleted account', () => {
  test('deletes what the user wrote and what others wrote on the readings of the user', async ({
    app,
    factories,
    dataSource,
  }) => {
    for (const [readingId, readerId, authorId] of [
      [BENS_READING, BEN, ANN],
      [ANNS_READING, ANN, BEN],
      [BENS_READING, BEN, CID],
      [CIDS_READING, CID, BEN],
    ] as const) {
      await arrangeInsight(factories, { readingId, readerId, authorId });
      await arrangeCongratulation(factories, { readingId, readerId, authorId });
    }

    await erase(app, ANN);

    const left = [
      { readingId: BENS_READING, readerId: BEN, authorId: CID },
      { readingId: CIDS_READING, readerId: CID, authorId: BEN },
    ];
    expect(
      (await storedInsights(dataSource)).map(({ readingId, readerId, authorId }) => ({
        readingId,
        readerId,
        authorId,
      })),
    ).toEqual(left);
    expect(await storedCongratulations(dataSource)).toEqual(left);
  });

  test('is idempotent: erasing again deletes nothing more', async ({
    app,
    factories,
    dataSource,
  }) => {
    await arrangeInsight(factories, { readingId: BENS_READING, readerId: BEN, authorId: ANN });
    await arrangeInsight(factories, { readingId: CIDS_READING, readerId: CID, authorId: BEN });

    await erase(app, ANN);
    await erase(app, ANN);

    expect(await storedInsights(dataSource)).toHaveLength(1);
  });
});
