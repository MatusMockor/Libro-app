import { describe, expect, it } from 'vitest';
import { computeTree, type TreeV1 } from '../src/index.ts';
import { MINUTE, part, reading, sessions } from './support/readings.ts';

const READING = sessions(30, 35 * MINUTE, (index) => [
  ...(index % 2 === 0 ? [part('good', index * 10 + 1, index * 10 + 4)] : []),
  ...(index % 3 === 0 ? [part('slow', index * 10 + 5, index * 10 + 9)] : []),
  ...(index % 5 === 0 ? [part('skipped', index * 10 + 2, index * 10 + 30)] : []),
]);

const treeAfter = (count: number, finished = false): TreeV1 =>
  computeTree(reading({ seed: 'growing', finished, sessions: READING.slice(0, count) }));

describe('growth continuity', () => {
  it.each([1, 2, 5, 10, 20, 29])('the next session after %i grows the same tree', (count) => {
    const before = treeAfter(count);
    const after = treeAfter(count + 1);

    expect(after.growth).toBeGreaterThan(before.growth);
    expect(after.trunk.height).toBeGreaterThanOrEqual(before.trunk.height);
    expect(after.trunk.thickness).toBeGreaterThanOrEqual(before.trunk.thickness);

    for (const branch of before.branches) {
      const grown = after.branches.find((candidate) => candidate.id === branch.id);

      expect(grown).toMatchObject({
        parentId: branch.parentId,
        position: branch.position,
        angle: branch.angle,
        bare: branch.bare,
      });
      expect(grown?.length).toBeGreaterThanOrEqual(branch.length);
      expect(grown?.thickness).toBeGreaterThanOrEqual(branch.thickness);
    }

    for (const flower of before.flowers) {
      expect(after.flowers).toContainEqual(flower);
    }

    for (const leaf of before.leaves) {
      const grown = after.leaves.find((candidate) => candidate.id === leaf.id);

      expect(grown).toMatchObject({ branchId: leaf.branchId, position: leaf.position });
      expect(grown?.size).toBeGreaterThanOrEqual(leaf.size);
    }
  });

  it.each([1, 2, 5, 10, 20, 29])(
    'fruits of a finished reading of %i sessions stay put when one more session is added',
    (count) => {
      const before = treeAfter(count, true);
      const after = treeAfter(count + 1, true);

      expect(after.fruits.length).toBeGreaterThanOrEqual(before.fruits.length);

      before.fruits.forEach((fruit, index) => {
        const grown = after.fruits[index];

        expect(grown?.id).toBe(fruit.id);
        expect(grown?.position).toBe(fruit.position);
        expect([fruit.branchId, `b${String(count)}`]).toContain(grown?.branchId);
        expect(grown?.size).toBeGreaterThanOrEqual(fruit.size);
      });
    },
  );

  it('adds exactly one branch per counted session', () => {
    expect(
      treeAfter(7)
        .branches.filter((branch) => !branch.bare)
        .map((branch) => branch.id),
    ).toEqual(['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6']);
  });
});
