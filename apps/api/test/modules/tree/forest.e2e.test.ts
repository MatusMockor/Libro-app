import { describe, expect, vi } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { ReadingEntity } from '../../../src/modules/reading-sessions/persistence/reading.entity.js';
import type {
  ReadingTreePageResponse,
  ReadingTreeResponse,
} from '../../../src/modules/tree/http/reading-tree.response.js';
import { storedTrees, test, treeRoute, type TreeReader } from './tree.fixture.js';

const FOREST_ROUTE = '/v1/me/forest';
const GROWING_ROUTE = '/v1/me/growing-trees';

const at = (day: number): Date => new Date(Date.UTC(2026, 9, day, 12));

function finishedOn(reader: TreeReader, day: number): Promise<ReadingEntity> {
  return reader.newReading({ startedAt: at(1), finishedAt: at(day) });
}

async function pageOf(reader: TreeReader, path: string): Promise<ReadingTreePageResponse> {
  const response = await reader.get(path);
  expect(response.status).toBe(200);

  return response.body as ReadingTreePageResponse;
}

const readingIds = ({ items }: ReadingTreePageResponse): string[] =>
  items.map(({ readingId }) => readingId);

describe('GET /v1/me/forest', () => {
  test('lists the trees of finished readings only, most recently finished first', async ({
    reader,
    newReader,
  }) => {
    const other = await newReader();
    await finishedOn(other, 9);
    const first = await finishedOn(reader, 3);
    const last = await finishedOn(reader, 5);
    const middle = await finishedOn(reader, 4);
    const growing = await reader.newReading();
    await reader.read(growing, { activeSeconds: 1800, checkpoints: [10] });

    const forest = await pageOf(reader, FOREST_ROUTE);

    expect(readingIds(forest)).toEqual([last.id, middle.id, first.id]);
    expect(forest.nextOffset).toBeNull();
    expect(forest.items.map(({ finished, finishedAt }) => ({ finished, finishedAt }))).toEqual([
      { finished: true, finishedAt: at(5).toISOString() },
      { finished: true, finishedAt: at(4).toISOString() },
      { finished: true, finishedAt: at(3).toISOString() },
    ]);
  });

  test('shows the same tree as the reading tree endpoint', async ({ reader }) => {
    const reading = await reader.newReading();
    await reader.read(reading, {
      activeSeconds: 2400,
      checkpoints: [25],
      markedParts: [{ kind: 'good', fromPage: 3, toPage: 20 }],
    });
    await reader.finish(reading);

    const forest = await pageOf(reader, FOREST_ROUTE);
    const tree = (await reader.get(treeRoute(reading.id))).body as ReadingTreeResponse;

    expect(forest.items).toStrictEqual([tree]);
    expect(tree.tree.stats.countedSessions).toBe(1);
  });

  test('pages with limit and offset', async ({ reader }) => {
    const middle = await finishedOn(reader, 3);
    const oldest = await finishedOn(reader, 2);
    const newest = await finishedOn(reader, 4);

    const first = await pageOf(reader, `${FOREST_ROUTE}?limit=2`);
    const second = await pageOf(reader, `${FOREST_ROUTE}?limit=2&offset=2`);

    expect([readingIds(first), first.nextOffset]).toEqual([[newest.id, middle.id], 2]);
    expect([readingIds(second), second.nextOffset]).toEqual([[oldest.id], null]);
  });

  test('records the tree engine version of every listed reading that has none', async ({
    reader,
    newReader,
    dataSource,
  }) => {
    const other = await newReader();
    await finishedOn(other, 9);
    const readings = [await finishedOn(reader, 3), await finishedOn(reader, 4)];

    await pageOf(reader, FOREST_ROUTE);
    const stored = await storedTrees(dataSource);

    expect(stored).toHaveLength(readings.length);
    expect(stored).toEqual(
      expect.arrayContaining(
        readings.map(({ id }) => ({ readingId: id, userId: reader.id, treeEngineVersion: 1 })),
      ),
    );
  });

  test('computes a page with the same number of queries for one tree or twenty', async ({
    reader,
    dataSource,
  }) => {
    for (let day = 1; day <= 20; day += 1) {
      const reading = await finishedOn(reader, day);
      await reader.read(reading, { activeSeconds: 600 });
    }
    const queries = vi.spyOn(dataSource.logger, 'logQuery');
    const countQueries = async (path: string): Promise<number> => {
      queries.mockClear();
      await pageOf(reader, path);
      return queries.mock.calls.length;
    };

    const firstRead = await countQueries(`${FOREST_ROUTE}?limit=20`);
    const oneTree = await countQueries(`${FOREST_ROUTE}?limit=1`);
    const twentyTrees = await countQueries(`${FOREST_ROUTE}?limit=20`);
    queries.mockRestore();

    expect({ firstRead, oneTree, twentyTrees }).toEqual({
      firstRead: 7,
      oneTree: 5,
      twentyTrees: 5,
    });
  });
});

describe('GET /v1/me/growing-trees', () => {
  test('lists the growing trees of unfinished readings only, most recently started first', async ({
    reader,
    newReader,
  }) => {
    const other = await newReader();
    await other.newReading({ startedAt: at(9) });
    const older = await reader.newReading({ startedAt: at(1) });
    const newer = await reader.newReading({ startedAt: at(3) });
    await finishedOn(reader, 5);
    await reader.read(newer, { activeSeconds: 1800, checkpoints: [10] });

    const growing = await pageOf(reader, GROWING_ROUTE);
    const newerTree = (await reader.get(treeRoute(newer.id))).body as ReadingTreeResponse;

    expect(readingIds(growing)).toEqual([newer.id, older.id]);
    expect(growing.nextOffset).toBeNull();
    expect(growing.items[0]).toStrictEqual(newerTree);
    expect(
      growing.items.map(({ finished, finishedAt, tree }) => ({
        finished,
        finishedAt,
        stage: tree.stage,
      })),
    ).toEqual([
      { finished: false, finishedAt: null, stage: 'sapling' },
      { finished: false, finishedAt: null, stage: 'seed' },
    ]);
  });

  test('pages with limit and offset', async ({ reader }) => {
    const newest = await reader.newReading({ startedAt: at(3) });
    const oldest = await reader.newReading({ startedAt: at(1) });

    const first = await pageOf(reader, `${GROWING_ROUTE}?limit=1`);
    const second = await pageOf(reader, `${GROWING_ROUTE}?limit=1&offset=1`);

    expect([readingIds(first), first.nextOffset]).toEqual([[newest.id], 1]);
    expect([readingIds(second), second.nextOffset]).toEqual([[oldest.id], null]);
  });
});

describe.for([FOREST_ROUTE, GROWING_ROUTE])('GET %s', (route) => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.get(route);

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('answers an empty page when there is nothing to list', async ({ reader }) => {
    expect(await pageOf(reader, route)).toStrictEqual({ items: [], nextOffset: null });
  });

  test.for([
    ['limit=0', 'limit', 'too_small'],
    ['limit=21', 'limit', 'too_big'],
    ['limit=2.5', 'limit', 'invalid_type'],
    ['offset=-1', 'offset', 'too_small'],
    ['offset=1001', 'offset', 'too_big'],
  ] as const)('answers 400 validation_failed for %s', async ([query, path, code], { reader }) => {
    const response = await reader.get(`${route}?${query}`);
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors?.map((error) => ({ path: error.path, code: error.code }))).toEqual([
      { path, code },
    ]);
  });
});
