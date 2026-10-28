import { describe, expect, it } from 'vitest';
import { computeTree } from '../src/index.ts';
import { fnv1a32 } from '../src/v1/random.ts';
import { HOUR, part, reading, sessions } from './support/readings.ts';
import { PROFILES } from './support/profiles.ts';

const HUGE = reading({
  seed: 'huge',
  finished: true,
  sessions: sessions(1000, 10 * HOUR, (index) => [
    part('good', index, index + 30),
    part('slow', index, index + 5),
    part('skipped', index, index + 80),
  ]),
  decorations: Array.from({ length: 150 }, (_, index) => ({
    id: `decoration-${String(index)}`,
    kind: 'insight' as const,
  })),
});

describe('tree engine v1 is frozen', () => {
  it.each(Object.entries(PROFILES))('keeps the golden output for "%s"', (_, input) => {
    expect(computeTree(input, 1)).toMatchSnapshot();
  });

  it('keeps the golden fingerprint of a capped huge reading', () => {
    expect(fnv1a32(JSON.stringify(computeTree(HUGE, 1)))).toMatchSnapshot();
  });
});

describe('tree engine v1 determinism', () => {
  it.each(Object.entries(PROFILES))(
    'gives identical output on repeated calls for "%s"',
    (_, input) => {
      const first = computeTree(input);

      expect(computeTree(input)).toEqual(first);
      expect(JSON.stringify(computeTree(structuredClone(input)))).toBe(JSON.stringify(first));
    },
  );

  it('gives different trees for different seeds', () => {
    const input = PROFILES['liked it'];

    expect(computeTree({ ...input, seed: 'another-reading' }).branches).not.toEqual(
      computeTree(input).branches,
    );
  });
});
