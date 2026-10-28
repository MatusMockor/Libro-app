import { HALF_GROWTH_SECONDS } from './limits.ts';
import { saturate, scale } from './numbers.ts';
import type { TreeStageV1, TrunkV1 } from './types.ts';

const SEED_TRUNK_HEIGHT = 20;
const TRUNK_HEIGHT_RANGE = 380;
const SEED_TRUNK_THICKNESS = 2;
const TRUNK_THICKNESS_RANGE = 46;
const SAPLING_BELOW = 250;
const YOUNG_BELOW = 600;

export function growthFor(countedSeconds: number): number {
  return saturate(countedSeconds, HALF_GROWTH_SECONDS);
}

export function stageFor(countedSessions: number, growth: number): TreeStageV1 {
  if (countedSessions === 0) {
    return 'seed';
  }

  if (growth < SAPLING_BELOW) {
    return 'sapling';
  }

  if (growth < YOUNG_BELOW) {
    return 'young';
  }

  return 'mature';
}

export function trunkFor(growth: number): TrunkV1 {
  return {
    height: SEED_TRUNK_HEIGHT + scale(TRUNK_HEIGHT_RANGE, growth),
    thickness: SEED_TRUNK_THICKNESS + scale(TRUNK_THICKNESS_RANGE, growth),
  };
}
