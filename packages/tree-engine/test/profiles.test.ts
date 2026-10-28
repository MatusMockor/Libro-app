import { describe, expect, it } from 'vitest';
import { computeTree } from '../src/index.ts';
import {
  HOUR,
  MINUTE,
  part,
  reading,
  session,
  sessions,
  withoutParts,
} from './support/readings.ts';
import { GROUP, LIKED_IT, SKIMMED, SLOW_READ, STARTED } from './support/profiles.ts';
import { shapeOf } from './support/tree-shape.ts';

describe('a reading with no counted sessions', () => {
  it('is a seed with a tiny trunk and nothing else', () => {
    const tree = computeTree(reading({ sessions: [session(2 * MINUTE)] }));

    expect(tree).toMatchObject({
      stage: 'seed',
      growth: 0,
      trunk: { height: 20, thickness: 2 },
      branches: [],
      leaves: [],
      flowers: [],
      fruits: [],
    });
  });

  it('still bears a fruit on the trunk when the book is finished', () => {
    const tree = computeTree(reading({ finished: true }));

    expect(tree.fruits).toHaveLength(1);
    expect(tree.fruits[0]?.branchId).toBeNull();
  });
});

describe('a started reading', () => {
  it('is a small growing tree with one branch per counted session and no fruit', () => {
    const tree = computeTree(STARTED);

    expect(tree.stage).toBe('sapling');
    expect(tree.branches.map((branch) => branch.id)).toEqual(['b0', 'b1']);
    expect(tree.leaves.length).toBeGreaterThan(0);
    expect(tree.flowers).toHaveLength(1);
    expect(tree.fruits).toEqual([]);
  });
});

describe('a book the reader liked', () => {
  it('grows a mature tree with a flower per good part and fruits', () => {
    const tree = computeTree(LIKED_IT);
    const goodParts = LIKED_IT.sessions.flatMap((entry) => entry.markedParts).length;

    expect(tree.stage).toBe('mature');
    expect(tree.branches).toHaveLength(12);
    expect(tree.flowers).toHaveLength(goodParts);
    expect(tree.fruits.length).toBeGreaterThan(1);
  });

  it('gives longer good parts bigger flowers', () => {
    const tree = computeTree(
      reading({
        sessions: [session(HOUR, [part('good', 1, 2)]), session(HOUR, [part('good', 1, 100)])],
      }),
    );
    const [short, long] = tree.flowers;

    expect(tree.flowers).toHaveLength(2);
    expect(long?.size).toBeGreaterThan(short?.size ?? 0);
  });

  it('only bears fruit once the book is finished', () => {
    const unfinished = computeTree({ ...LIKED_IT, finished: false });
    const finished = computeTree(LIKED_IT);

    expect(unfinished.fruits).toEqual([]);
    expect({ ...shapeOf(unfinished), fruits: [] }).toEqual({ ...shapeOf(finished), fruits: [] });
  });
});

describe('a skimmed book', () => {
  const tree = computeTree(SKIMMED);
  const unskipped = computeTree(withoutParts(SKIMMED, 'skipped'));

  it('grows thin bare twigs for skipped parts', () => {
    const twigs = tree.branches.filter((branch) => branch.bare);

    expect(twigs).toHaveLength(4);
    expect(twigs.map((twig) => twig.id)).toEqual(['b0.t0', 'b0.t1', 'b1.t0', 'b2.t0']);

    for (const twig of twigs) {
      const host = tree.branches.find((branch) => branch.id === twig.parentId);

      expect(twig.thickness).toBeLessThanOrEqual(host?.thickness ?? 0);
      expect(twig.length).toBeLessThan(host?.length ?? 0);
      expect(tree.leaves.some((leaf) => leaf.branchId === twig.id)).toBe(false);
    }
  });

  it('is not smaller than the same reading without skipped parts', () => {
    expect(tree.growth).toBe(unskipped.growth);
    expect(tree.trunk).toEqual(unskipped.trunk);
    expect(tree.branches.filter((branch) => !branch.bare)).toEqual(unskipped.branches);
    expect(tree.leaves).toEqual(unskipped.leaves);
    expect(tree.fruits).toEqual(unskipped.fruits);
  });
});

describe('a slowly read book', () => {
  it('has denser foliage and the same size as without slow parts', () => {
    const tree = computeTree(SLOW_READ);
    const brisk = computeTree(withoutParts(SLOW_READ, 'slow'));

    expect(tree.leaves.length).toBeGreaterThan(brisk.leaves.length);
    expect(tree.trunk).toEqual(brisk.trunk);
    expect(tree.branches).toEqual(brisk.branches);
    expect(tree.stage).toBe(brisk.stage);
  });

  it('keeps every leaf of the brisk reading', () => {
    const tree = computeTree(SLOW_READ);
    const brisk = computeTree(withoutParts(SLOW_READ, 'slow'));
    const leafIds = new Set(tree.leaves.map((leaf) => leaf.id));

    expect(brisk.leaves.every((leaf) => leafIds.has(leaf.id))).toBe(true);
  });
});

describe('a book read in a group', () => {
  it('carries the group reading as decorations without changing the shape', () => {
    const tree = computeTree(GROUP);
    const alone = computeTree({ ...GROUP, decorations: [] });
    const branchIds = new Set(tree.branches.map((branch) => branch.id));

    expect(shapeOf(tree)).toEqual(shapeOf(alone));
    expect(tree.decorations.map((placed) => [placed.id, placed.kind])).toEqual([
      ['group-1', 'group_reading'],
      ['group-2', 'group_reading'],
      ['insight-1', 'insight'],
      ['congrats-1', 'congratulation'],
    ]);
    expect(tree.decorations.every((placed) => branchIds.has(placed.branchId ?? ''))).toBe(true);
  });
});

describe('stages', () => {
  it.each([
    [1, 'sapling'],
    [4, 'young'],
    [12, 'mature'],
  ] as const)('%i hour-long sessions grow a %s', (count, stage) => {
    expect(computeTree(reading({ sessions: sessions(count, HOUR) })).stage).toBe(stage);
  });
});
