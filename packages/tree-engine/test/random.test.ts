import { describe, expect, it } from 'vitest';
import { fmix32, fnv1a32, hashKey, mulberry32 } from '../src/v1/random.ts';

describe('v1 hashing', () => {
  it('matches the published FNV-1a 32-bit test vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('matches the MurmurHash3 32-bit finaliser', () => {
    expect(fmix32(0)).toBe(0);
    expect(fmix32(1)).toBe(0x514e28b7);
    expect(fmix32(0xdeadbeef)).toBe(233162409);
  });

  it('hashes key parts to fixed unsigned 32-bit integers', () => {
    expect(hashKey('reading-1', 'branch', '0')).toBe(3424515715);
    expect(hashKey('reading-1')).toBe(1426266347);
    expect(hashKey('')).toBe(2872998923);
  });
});

describe('v1 seeded random', () => {
  it.each([
    [0, [1144304738, 1416247, 958946056, 627933444]],
    [1, [2693262067, 11749833, 2265367787, 4213581821]],
    [123456789, [1107202814, 4169434471, 3372958138, 885470128]],
    [0xffffffff, [3850105811, 813802916, 3073704848, 4054706436]],
  ])('mulberry32(%i) gives the reference sequence', (seed, expected) => {
    const random = mulberry32(seed);

    expect(Array.from({ length: 4 }, () => random.nextUint32())).toEqual(expected);
  });

  it('derives bounded integers and signs from the sequence', () => {
    const random = mulberry32(42);

    expect([
      random.int(1, 6),
      random.int(1, 6),
      random.int(-10, 10),
      random.sign(),
      random.sign(),
    ]).toEqual([1, 5, -10, 1, -1]);
  });

  it('keeps int() within its inclusive bounds', () => {
    const random = mulberry32(7);
    const values = Array.from({ length: 2000 }, () => random.int(3, 9));

    expect(Math.min(...values)).toBe(3);
    expect(Math.max(...values)).toBe(9);
    expect(values.every(Number.isInteger)).toBe(true);
  });
});
