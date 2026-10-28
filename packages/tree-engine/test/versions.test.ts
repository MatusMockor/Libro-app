import { describe, expect, it } from 'vitest';
import {
  computeTree,
  computeTreeV1,
  isTreeEngineVersion,
  LATEST_TREE_ENGINE_VERSION,
  TREE_ENGINE_VERSIONS,
  type TreeEngineVersion,
  UnknownTreeEngineVersionError,
} from '../src/index.ts';
import { LIKED_IT } from './support/profiles.ts';

const UNKNOWN_VERSION = 2 as unknown as TreeEngineVersion;

describe('tree engine versions', () => {
  it('computes with the latest version by default', () => {
    expect(LATEST_TREE_ENGINE_VERSION).toBe(1);
    expect(computeTree(LIKED_IT)).toEqual(computeTree(LIKED_IT, 1));
    expect(computeTree(LIKED_IT, 1)).toEqual(computeTreeV1(LIKED_IT));
    expect(computeTree(LIKED_IT).treeEngineVersion).toBe(1);
  });

  it('lists every available version', () => {
    expect(Object.keys(TREE_ENGINE_VERSIONS)).toEqual(['1']);
  });

  it.each([
    [1, true],
    [2, false],
    [0, false],
    ['1', false],
    [Number.NaN, false],
    [null, false],
  ])('recognises %s as a known version: %s', (value, known) => {
    expect(isTreeEngineVersion(value)).toBe(known);
  });

  it('rejects an unknown version with a typed error', () => {
    expect(() => computeTree(LIKED_IT, UNKNOWN_VERSION)).toThrow(UnknownTreeEngineVersionError);
    expect(() => computeTree(LIKED_IT, UNKNOWN_VERSION)).toThrow('Unknown tree engine version: 2');
  });

  it('rejects a null version instead of falling back to the latest one', () => {
    const missing = null as unknown as TreeEngineVersion;

    expect(() => computeTree(LIKED_IT, missing)).toThrow(UnknownTreeEngineVersionError);
    expect(() => computeTree(LIKED_IT, missing)).toThrow('Unknown tree engine version: null');
  });
});
