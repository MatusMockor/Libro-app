import { describe, expect, it } from 'vitest';
import { computeTree } from '../src/index.ts';
import { decoration, HOUR, reading, sessions } from './support/readings.ts';
import { LIKED_IT } from './support/profiles.ts';
import { shapeOf } from './support/tree-shape.ts';

const FRIENDS = ['anna', 'boris', 'cyril', 'dana', 'eva', 'fero', 'gita', 'hugo'].map((id) =>
  decoration(`insight-${id}`),
);

describe('decorations', () => {
  it('adding a decoration keeps the shape and every existing placement', () => {
    const before = computeTree({ ...LIKED_IT, decorations: FRIENDS.slice(0, 5) });
    const after = computeTree({
      ...LIKED_IT,
      decorations: [...FRIENDS.slice(0, 5), decoration('congrats-1', 'congratulation')],
    });

    expect(shapeOf(after)).toEqual(shapeOf(before));
    expect(after.decorations.slice(0, 5)).toEqual(before.decorations);
    expect(after.decorations).toHaveLength(6);
  });

  it('removing a decoration keeps the shape and every other placement', () => {
    const all = computeTree({ ...LIKED_IT, decorations: FRIENDS });
    const removed = computeTree({
      ...LIKED_IT,
      decorations: FRIENDS.filter((friend) => friend.id !== 'insight-cyril'),
    });

    expect(shapeOf(removed)).toEqual(shapeOf(all));
    expect(removed.decorations).toEqual(
      all.decorations.filter((placed) => placed.id !== 'insight-cyril'),
    );
  });

  it('places a decoration by its own id, wherever it is in the list', () => {
    const forwards = computeTree({ ...LIKED_IT, decorations: FRIENDS });
    const backwards = computeTree({ ...LIKED_IT, decorations: [...FRIENDS].reverse() });

    expect([...backwards.decorations].reverse()).toEqual(forwards.decorations);
  });

  it('spreads decorations over the branches', () => {
    const tree = computeTree({ ...LIKED_IT, decorations: FRIENDS });

    expect(new Set(tree.decorations.map((placed) => placed.branchId)).size).toBeGreaterThan(3);
  });

  it('moves a decoration only onto a new branch when the tree grows', () => {
    const smaller = computeTree(reading({ sessions: sessions(6, HOUR), decorations: FRIENDS }));
    const larger = computeTree(reading({ sessions: sessions(7, HOUR), decorations: FRIENDS }));

    larger.decorations.forEach((placed, index) => {
      const earlier = smaller.decorations[index];

      expect(placed.position).toBe(earlier?.position);
      expect([earlier?.branchId, 'b6']).toContain(placed.branchId);
    });
  });

  it('sits on the trunk of a seed', () => {
    const tree = computeTree(reading({ decorations: [decoration('group-1', 'group_reading')] }));

    expect(tree.decorations).toEqual([
      {
        id: 'group-1',
        kind: 'group_reading',
        branchId: null,
        position: expect.any(Number) as number,
      },
    ]);
  });

  it('keeps at most 100 decorations', () => {
    const many = Array.from({ length: 150 }, (_, index) => decoration(`d-${String(index)}`));

    expect(computeTree({ ...LIKED_IT, decorations: many }).decorations).toHaveLength(100);
  });
});
