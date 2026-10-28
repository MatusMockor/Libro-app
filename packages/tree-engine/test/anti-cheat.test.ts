import { describe, expect, it } from 'vitest';
import { computeTree } from '../src/index.ts';
import { HOUR, MINUTE, part, reading, session, sessions } from './support/readings.ts';
import { numbersIn } from './support/tree-shape.ts';

describe('counting rule', () => {
  it('counts only sessions with at least 5 active minutes and a checkpoint', () => {
    const tree = computeTree(
      reading({
        sessions: [
          session(299),
          session(300),
          session(HOUR, [], 0),
          session(HOUR, [], 3),
          session(Number.NaN),
        ],
      }),
    );

    expect(tree.stats).toEqual({
      countedSessions: 2,
      ignoredSessions: 3,
      countedSeconds: 300 + HOUR,
    });
    expect(tree.branches).toHaveLength(2);
  });

  it('ignores uncounted sessions entirely, marked parts included', () => {
    const counted = sessions(3, 40 * MINUTE, () => [part('good', 1, 5)]);
    const noise = session(2 * MINUTE, [
      part('good', 1, 5),
      part('skipped', 6, 9),
      part('slow', 9, 12),
    ]);
    const clean = computeTree(reading({ sessions: counted }));
    const noisy = computeTree(
      reading({
        sessions: counted.flatMap((entry) => [
          noise,
          entry,
          session(HOUR, [part('good', 1, 2)], 0),
        ]),
      }),
    );

    expect({ ...noisy, stats: { ...noisy.stats, ignoredSessions: 0 } }).toEqual(clean);
    expect(noisy.stats.ignoredSessions).toBe(6);
  });
});

describe('diminishing returns', () => {
  it('grows one 10-hour session much less than ten 1-hour sessions', () => {
    const marathon = computeTree(reading({ sessions: [session(10 * HOUR)] }));
    const steady = computeTree(reading({ sessions: sessions(10, HOUR) }));

    expect(steady.growth).toBeGreaterThan(2 * marathon.growth);
    expect(steady.trunk.height).toBeGreaterThan(marathon.trunk.height);
    expect(steady.branches.length).toBeGreaterThan(marathon.branches.length);
  });

  it('caps what a single session contributes at 2 hours', () => {
    const twoHours = computeTree(reading({ sessions: [session(2 * HOUR)] }));
    const tenHours = computeTree(reading({ sessions: [session(10 * HOUR)] }));

    expect(tenHours).toEqual(twoHours);
    expect(tenHours.stats.countedSeconds).toBe(2 * HOUR);
  });

  it('saturates growth and bounds the output for 1000 sessions', () => {
    const everything = (index: number) => [
      part('good', index, index + 100),
      part('good', index, index + 1),
      part('slow', index, index + 100),
      part('skipped', index, index + 100),
    ];
    const thousand = computeTree(
      reading({ finished: true, sessions: sessions(1000, 10 * HOUR, everything) }),
    );
    const fiveHundred = computeTree(
      reading({ finished: true, sessions: sessions(500, 10 * HOUR, everything) }),
    );

    expect(thousand.growth).toBeLessThan(1000);
    expect(thousand.growth - fiveHundred.growth).toBeLessThanOrEqual(3);
    expect(thousand.trunk.height).toBeLessThan(400);
    expect(thousand.trunk.thickness).toBeLessThan(48);
    expect(thousand.branches.filter((branch) => !branch.bare)).toHaveLength(40);
    expect(thousand.branches.filter((branch) => branch.bare)).toHaveLength(80);
    expect(thousand.leaves).toHaveLength(480);
    expect(thousand.flowers).toHaveLength(120);
    expect(thousand.fruits.length).toBeLessThanOrEqual(8);
    expect(Math.max(...numbersIn(thousand))).toBeLessThan(10_000_000);
  });

  it('keeps growing with more sessions, only ever slower', () => {
    const growth = Array.from(
      { length: 31 },
      (_, count) => computeTree(reading({ sessions: sessions(count, HOUR) })).growth,
    );
    const gains = growth.slice(1).map((value, index) => value - (growth[index] ?? 0));

    expect(gains.every((gain) => gain > 0)).toBe(true);
    expect(gains.at(-1)).toBeLessThan((gains[0] ?? 0) / 4);
  });
});
