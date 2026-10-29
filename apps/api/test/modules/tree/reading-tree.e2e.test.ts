import { randomUUID } from 'node:crypto';
import { computeTree } from '@libro/tree-engine';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { ReadingTreeResponse } from '../../../src/modules/tree/http/reading-tree.response.js';
import { ANY_ISO_DATE } from '../../support/matchers.js';
import { CapturingLogger } from '../../support/capturing-logger.js';
import { engineSession, storedTrees, test, treeRoute, type TreeReader } from './tree.fixture.js';

const COUNTED = { activeSeconds: 1800, checkpoints: [30] } as const;

async function treeOf(reader: TreeReader, readingId: string): Promise<ReadingTreeResponse> {
  const response = await reader.get(treeRoute(readingId));
  expect(response.status).toBe(200);

  return response.body as ReadingTreeResponse;
}

describe('GET /v1/readings/:readingId/tree', () => {
  test('starts as a seed and grows with every counted session', async ({ reader }) => {
    const reading = await reader.newReading();

    const seed = await treeOf(reader, reading.id);
    await reader.read(reading, COUNTED);
    const first = await treeOf(reader, reading.id);
    await reader.read(reading, {
      activeSeconds: 3600,
      checkpoints: [60, 90],
      markedParts: [{ kind: 'good', fromPage: 40, toPage: 60 }],
    });
    const second = await treeOf(reader, reading.id);

    expect(seed).toStrictEqual({
      readingId: reading.id,
      workId: reading.workId,
      finished: false,
      finishedAt: null,
      tree: expect.objectContaining({
        treeEngineVersion: 1,
        stage: 'seed',
        growth: 0,
        branches: [],
        fruits: [],
        decorations: [],
        stats: { countedSessions: 0, ignoredSessions: 0, countedSeconds: 0 },
      }) as ReadingTreeResponse['tree'],
    });
    expect(first.tree).toMatchObject({
      stage: 'sapling',
      stats: { countedSessions: 1, ignoredSessions: 0, countedSeconds: 1800 },
    });
    expect(first.tree.branches).toHaveLength(1);
    expect(second.tree.growth).toBeGreaterThan(first.tree.growth);
    expect(second.tree.trunk.height).toBeGreaterThan(first.tree.trunk.height);
    expect(second.tree.branches).toHaveLength(2);
    expect(second.tree.flowers.length).toBeGreaterThan(0);
    expect(second.tree.stats).toStrictEqual({
      countedSessions: 2,
      ignoredSessions: 0,
      countedSeconds: 5400,
    });
  });

  test('does not change while a session is still open', async ({ reader }) => {
    const reading = await reader.newReading();
    await reader.read(reading, COUNTED);
    const before = await treeOf(reader, reading.id);

    await reader.read(reading, {
      activeSeconds: 7200,
      checkpoints: [80],
      markedParts: [{ kind: 'slow', fromPage: 50, toPage: 70 }],
      open: true,
    });

    expect(await treeOf(reader, reading.id)).toStrictEqual(before);
  });

  test('ignores sessions that are too short or have no checkpoint', async ({ reader }) => {
    const reading = await reader.newReading();
    await reader.read(reading, {
      activeSeconds: 200,
      checkpoints: [10],
      markedParts: [{ kind: 'good', fromPage: 1, toPage: 10 }],
    });
    await reader.read(reading, { activeSeconds: 3600 });

    const { tree } = await treeOf(reader, reading.id);

    expect(tree).toMatchObject({
      stage: 'seed',
      growth: 0,
      branches: [],
      flowers: [],
      stats: { countedSessions: 0, ignoredSessions: 2, countedSeconds: 0 },
    });
  });

  test('gives the same tree for the same reading data, equal to the engine output', async ({
    reader,
  }) => {
    const reading = await reader.newReading();
    const sessions = [
      await reader.read(reading, {
        activeSeconds: 2400,
        checkpoints: [20, 35],
        markedParts: [
          { kind: 'good', fromPage: 5, toPage: 30 },
          { kind: 'skipped', fromPage: 31, toPage: 35 },
        ],
      }),
      await reader.read(reading, { activeSeconds: 100, checkpoints: [36] }),
      await reader.read(reading, {
        activeSeconds: 5000,
        checkpoints: [70],
        markedParts: [{ kind: 'slow', fromPage: 40, toPage: 70 }],
      }),
    ];
    await reader.finish(reading);

    const first = await treeOf(reader, reading.id);
    const second = await treeOf(reader, reading.id);

    expect(second).toStrictEqual(first);
    expect(first.tree).toStrictEqual(
      computeTree(
        {
          seed: reading.id,
          finished: true,
          sessions: sessions.map(engineSession),
          decorations: [],
        },
        1,
      ),
    );
  });

  test('records the tree engine version when the book is finished and computes with it', async ({
    reader,
    dataSource,
  }) => {
    const reading = await reader.newReading();
    await reader.read(reading, COUNTED);

    await reader.finish(reading);
    const stored = await storedTrees(dataSource);
    const { finished, finishedAt, tree } = await treeOf(reader, reading.id);

    expect(stored).toEqual([{ readingId: reading.id, userId: reader.id, treeEngineVersion: 1 }]);
    expect({ finished, finishedAt }).toEqual({ finished: true, finishedAt: ANY_ISO_DATE });
    expect(tree.treeEngineVersion).toBe(stored[0]?.treeEngineVersion);
    expect(tree.fruits.length).toBeGreaterThan(0);
  });

  test('records the version of a finished reading whose event was lost on its first read', async ({
    reader,
    dataSource,
  }) => {
    const reading = await reader.newReading({
      startedAt: new Date('2026-10-01T08:00:00Z'),
      finishedAt: new Date('2026-10-02T20:00:00Z'),
    });
    const before = await storedTrees(dataSource);

    const { finishedAt, tree } = await treeOf(reader, reading.id);
    await treeOf(reader, reading.id);

    expect(before).toEqual([]);
    expect(finishedAt).toBe('2026-10-02T20:00:00.000Z');
    expect(tree.treeEngineVersion).toBe(1);
    expect(await storedTrees(dataSource)).toEqual([
      { readingId: reading.id, userId: reader.id, treeEngineVersion: 1 },
    ]);
  });

  test('answers 500 tree_engine_version_unavailable for a stored version the engine does not know', async ({
    app,
    reader,
    dataSource,
  }) => {
    const logger = new CapturingLogger();
    app.useLogger(logger);
    const reading = await reader.newReading();
    await reader.finish(reading);
    await dataSource.query('UPDATE tree.finished_trees SET tree_engine_version = 99');

    const response = await reader.get(treeRoute(reading.id));
    const forest = await reader.get('/v1/me/forest');

    for (const answer of [response, forest]) {
      expect(answer.status).toBe(500);
      expect(answer.body).toMatchObject({
        title: 'Internal Server Error',
        status: 500,
        detail: 'Internal Server Error',
        code: 'tree_engine_version_unavailable',
      });
    }
    expect(logger.errors.join('\n')).toContain(`Reading ${reading.id} has tree engine version 99`);
    expect(await storedTrees(dataSource)).toEqual([
      { readingId: reading.id, userId: reader.id, treeEngineVersion: 99 },
    ]);
  });

  test('answers 404 for a reading of another user exactly like for an unknown id', async ({
    reader,
    newReader,
  }) => {
    const other = await newReader();
    const theirs = await other.newReading();

    const foreign = await reader.get(treeRoute(theirs.id));
    const unknown = await reader.get(treeRoute(randomUUID()));

    for (const response of [foreign, unknown]) {
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        title: 'Not Found',
        detail: 'No such reading.',
        code: 'reading_not_found',
      });
    }
  });

  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.get(treeRoute(randomUUID()));

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('answers 400 validation_failed for a reading id that is not a UUID', async ({ reader }) => {
    const response = await reader.get(treeRoute('first-reading'));
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.errors?.map(({ path, code }) => ({ path, code }))).toEqual([
      { path: 'readingId', code: 'invalid_format' },
    ]);
  });
});
