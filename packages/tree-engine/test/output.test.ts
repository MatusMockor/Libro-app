import { describe, expect, it } from 'vitest';
import { computeTree, type TreeV1 } from '../src/index.ts';
import { HOUR, part, reading, session } from './support/readings.ts';
import { PROFILES } from './support/profiles.ts';
import { leafTypesIn, numbersIn } from './support/tree-shape.ts';

const ALLOWED_TYPES = ['number', 'string', 'boolean', 'null'];

const BAD_NUMBERS = [
  Number.NaN,
  -5,
  -0,
  0.5,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  1e308,
];

const BAD_READING = reading({
  seed: 'bad-numbers',
  finished: true,
  sessions: [
    ...BAD_NUMBERS.map((value) => session(value, [part('good', value, value)])),
    session(HOUR + 0.75, [
      ...BAD_NUMBERS.map((value) => part('slow', value, -value)),
      part('skipped', 400, 2),
      part('good', Number.NaN, 1e308),
    ]),
  ],
});

const TREES: [string, TreeV1][] = [
  ...Object.entries(PROFILES).map(([name, input]): [string, TreeV1] => [name, computeTree(input)]),
  ['bad numbers', computeTree(BAD_READING)],
];

describe('output', () => {
  it.each(TREES)('"%s" holds only integers, strings, booleans and nulls', (_, tree) => {
    const numbers = numbersIn(tree);

    expect(numbers.filter((value) => !Number.isSafeInteger(value) || Object.is(value, -0))).toEqual(
      [],
    );
    expect(leafTypesIn(tree).filter((type) => !ALLOWED_TYPES.includes(type))).toEqual([]);
  });

  it.each(TREES)('"%s" keeps positions, angles and references valid', (_, tree) => {
    const seen = new Set<string>();

    for (const branch of tree.branches) {
      expect(branch.parentId === null || seen.has(branch.parentId)).toBe(true);
      expect(Math.abs(branch.angle)).toBeLessThanOrEqual(90);
      seen.add(branch.id);
    }

    const attachments = [
      ...tree.branches,
      ...tree.leaves,
      ...tree.flowers,
      ...tree.fruits,
      ...tree.decorations,
    ];

    for (const attachment of attachments) {
      expect(attachment.position).toBeGreaterThanOrEqual(0);
      expect(attachment.position).toBeLessThanOrEqual(1000);
    }

    for (const item of [...tree.leaves, ...tree.flowers, ...tree.fruits, ...tree.decorations]) {
      expect(item.branchId === null || seen.has(item.branchId)).toBe(true);
    }

    const ids = [...tree.branches, ...tree.leaves, ...tree.flowers, ...tree.fruits].map(
      (item) => item.id,
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('treats bad numbers as zero without throwing', () => {
    const tree = computeTree(BAD_READING);

    expect(tree.stats).toEqual({
      countedSessions: 2,
      ignoredSessions: 6,
      countedSeconds: 7200 + HOUR,
    });
    expect(tree.treeEngineVersion).toBe(1);
  });
});
