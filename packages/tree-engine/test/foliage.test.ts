import { describe, expect, it } from 'vitest';
import { computeTree, type MarkedPartInputV1, type SessionInputV1 } from '../src/index.ts';
import { HOUR, part, reading, session, sessions } from './support/readings.ts';

const FORTY_HOURS = sessions(40, HOUR);

const withPartsOnFirst = (parts: readonly MarkedPartInputV1[]): SessionInputV1[] =>
  FORTY_HOURS.map((entry, index) => (index === 0 ? { ...entry, markedParts: parts } : entry));

describe('per-branch budgets', () => {
  it('never evicts leaves of other branches when one session has many slow parts', () => {
    const before = computeTree(reading({ sessions: FORTY_HOURS }));
    const slowParts = Array.from({ length: 100 }, (_, index) => part('slow', index, index + 80));
    const after = computeTree(reading({ sessions: withPartsOnFirst(slowParts) }));

    expect(before.leaves).toHaveLength(160);

    for (const leaf of before.leaves) {
      expect(after.leaves).toContainEqual(leaf);
    }

    expect(after.leaves.filter((leaf) => leaf.branchId === 'b0').length).toBeGreaterThan(
      before.leaves.filter((leaf) => leaf.branchId === 'b0').length,
    );
    expect(after.leaves.length - before.leaves.length).toBeLessThanOrEqual(6);
  });

  it('never evicts flowers or twigs of other branches', () => {
    const shared = FORTY_HOURS.map((entry, index) => ({
      ...entry,
      markedParts: [part('good', index, index + 1), part('skipped', index, index + 9)],
    }));
    const before = computeTree(reading({ sessions: shared }));
    const crowded = shared.map((entry, index) =>
      index === 0
        ? {
            ...entry,
            markedParts: Array.from({ length: 50 }, (_, page) => [
              part('good', page, page + 1),
              part('skipped', page, page + 9),
            ]).flat(),
          }
        : entry,
    );
    const after = computeTree(reading({ sessions: crowded }));

    for (const flower of before.flowers) {
      expect(after.flowers).toContainEqual(flower);
    }

    for (const branch of before.branches) {
      expect(after.branches).toContainEqual(branch);
    }
  });

  it('stays fast and bounded for a million slow parts in one session', () => {
    const slowParts = Array.from({ length: 1_000_000 }, () => part('slow', 1, 100000));
    const tree = computeTree(reading({ sessions: [session(HOUR, slowParts)] }));

    expect(tree.leaves.filter((leaf) => leaf.id.startsWith('b0.s'))).toHaveLength(6);
    expect(tree.leaves.length).toBeLessThanOrEqual(12);
  }, 2000);
});
