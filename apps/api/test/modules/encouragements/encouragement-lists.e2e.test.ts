import { randomUUID } from 'node:crypto';
import { describe, expect, vi } from 'vitest';
import type { EncouragementPageResponse } from '../../../src/modules/encouragements/http/encouragement.response.js';
import {
  arrangeCongratulation,
  arrangeInsight,
  codeOf,
  encouragementsRoute,
  errorsOf,
  test,
  type Member,
} from './encouragements.fixture.js';

const at = (minute: number): Date => new Date(Date.UTC(2026, 9, 1, 12, minute));

const decorationIdsOf = ({ items }: EncouragementPageResponse): string[] =>
  items.map(({ decorationId }) => decorationId);

async function allPages(member: Member, readingId: string, limit: number): Promise<string[]> {
  const seen: string[] = [];
  let cursor: string | null = '';
  for (let page = 0; cursor !== null && page < 20; page += 1) {
    const query: string = cursor ? `&cursor=${cursor}` : '';
    const found = await member.page(
      `${encouragementsRoute(readingId)}?limit=${String(limit)}${query}`,
    );
    seen.push(...decorationIdsOf(found));
    cursor = found.nextCursor;
  }

  return seen;
}

describe('GET /v1/readings/:readingId/encouragements', () => {
  test('lists every insight and congratulation of the reading for its reader, newest first', async ({
    reader,
    friend,
    newMember,
  }) => {
    const other = await newMember({ handle: 'druha.citatelka' });
    await other.follows(reader);
    const reading = await reader.openReading();
    const first = await friend.addInsight(reading.id, 'First thought');
    const second = await other.addInsight(reading.id, 'Second thought');

    const page = await reader.page(encouragementsRoute(reading.id));

    expect(page).toStrictEqual({
      items: [
        {
          decorationId: `insight:${second.id}`,
          kind: 'insight',
          insightId: second.id,
          authorId: other.id,
          author: expect.objectContaining({
            userId: other.id,
            handle: 'druha.citatelka',
            followedByMe: false,
          }) as unknown,
          text: 'Second thought',
          createdAt: second.createdAt,
        },
        {
          decorationId: `insight:${first.id}`,
          kind: 'insight',
          insightId: first.id,
          authorId: friend.id,
          author: expect.objectContaining({ userId: friend.id }) as unknown,
          text: 'First thought',
          createdAt: first.createdAt,
        },
      ],
      nextCursor: null,
    });
  });

  test('lists congratulations with their author and no text', async ({ reader, friend }) => {
    const reading = await reader.finishedReading();
    await friend.congratulate(reading.id);

    const page = await reader.page(encouragementsRoute(reading.id));

    expect(page.items).toStrictEqual([
      {
        decorationId: `congratulation:${friend.id}`,
        kind: 'congratulation',
        insightId: null,
        authorId: friend.id,
        author: expect.objectContaining({ userId: friend.id }) as unknown,
        text: null,
        createdAt: expect.any(String) as unknown,
      },
    ]);
  });

  test('shows a follower only their own insights and congratulation', async ({
    reader,
    friend,
    newMember,
    factories,
  }) => {
    const other = await newMember();
    await other.follows(reader);
    const reading = await reader.finishedReading();
    const own = await arrangeInsight(factories, {
      readingId: reading.id,
      readerId: reader.id,
      authorId: friend.id,
      createdAt: at(1),
    });
    await arrangeInsight(factories, {
      readingId: reading.id,
      readerId: reader.id,
      authorId: other.id,
      createdAt: at(2),
    });
    await friend.congratulate(reading.id);
    await other.congratulate(reading.id);

    const page = await friend.page(encouragementsRoute(reading.id));

    expect(decorationIdsOf(page)).toEqual([`congratulation:${friend.id}`, `insight:${own.id}`]);
  });

  test('answers 404 reading_not_found alike for anyone else and an unknown reading', async ({
    reader,
    friend,
    newMember,
  }) => {
    const stranger = await newMember();
    const reading = await reader.openReading();
    await friend.addInsight(reading.id);

    const notFollowed = await stranger.get(encouragementsRoute(reading.id));
    const unknown = await stranger.get(encouragementsRoute(randomUUID()));

    expect([notFollowed.status, unknown.status]).toEqual([404, 404]);
    expect([codeOf(notFollowed.body), codeOf(unknown.body)]).toEqual([
      'reading_not_found',
      'reading_not_found',
    ]);
  });

  test('pages newest first with a cursor, never repeating or skipping an entry', async ({
    reader,
    newMember,
    factories,
  }) => {
    const reading = await reader.finishedReading();
    const expected: string[] = [];
    for (let minute = 0; minute < 7; minute += 1) {
      const author = await newMember();
      const insight = await arrangeInsight(factories, {
        readingId: reading.id,
        readerId: reader.id,
        authorId: author.id,
        createdAt: at(minute % 3),
      });
      await arrangeCongratulation(factories, {
        readingId: reading.id,
        readerId: reader.id,
        authorId: author.id,
        createdAt: at(minute % 3),
      });
      expected.push(`insight:${insight.id}`, `congratulation:${author.id}`);
    }
    const all = await reader.page(`${encouragementsRoute(reading.id)}?limit=50`);

    const paged = await allPages(reader, reading.id, 3);

    expect(all.items).toHaveLength(14);
    expect(all.nextCursor).toBeNull();
    expect(paged).toEqual(decorationIdsOf(all));
    expect([...paged].sort()).toEqual([...expected].sort());
    expect(all.items.map(({ createdAt }) => createdAt)).toEqual(
      [...all.items.map(({ createdAt }) => createdAt)].sort().reverse(),
    );
  });

  test('costs the same number of queries for one entry or fifty', async ({
    reader,
    newMember,
    factories,
    dataSource,
  }) => {
    const reading = await reader.finishedReading();
    for (let index = 0; index < 25; index += 1) {
      const author = await newMember();
      await arrangeInsight(factories, {
        readingId: reading.id,
        readerId: reader.id,
        authorId: author.id,
      });
      await arrangeCongratulation(factories, {
        readingId: reading.id,
        readerId: reader.id,
        authorId: author.id,
      });
    }
    const queries = vi.spyOn(dataSource.logger, 'logQuery');
    const countQueries = async (limit: number): Promise<number> => {
      queries.mockClear();
      const page = await reader.page(`${encouragementsRoute(reading.id)}?limit=${String(limit)}`);
      expect(page.items).toHaveLength(limit);

      return queries.mock.calls.length;
    };

    const one = await countQueries(1);
    const fifty = await countQueries(50);
    queries.mockRestore();

    expect(fifty).toBe(one);
  });

  test.for([
    ['limit=0', 'limit', 'too_small'],
    ['limit=51', 'limit', 'too_big'],
    ['cursor=not-a-cursor', 'cursor', 'custom'],
    [
      `cursor=${Buffer.from('{"createdAt":"2026-10-01T12:00:00.000000Z"}').toString('base64url')}`,
      'cursor',
      'custom',
    ],
  ] as const)('answers 400 validation_failed for %s', async ([query, path, code], { reader }) => {
    const reading = await reader.openReading();

    const response = await reader.get(`${encouragementsRoute(reading.id)}?${query}`);

    expect(response.status).toBe(400);
    expect(codeOf(response.body)).toBe('validation_failed');
    expect(errorsOf(response.body)).toEqual([{ path, code }]);
  });
});
