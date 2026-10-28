import { randomFor } from './random.ts';
import { rendezvousHost } from './rendezvous.ts';
import type { BranchV1, FruitV1 } from './types.ts';

const GROWTH_PER_FRUIT = 125;
const GROWTH_PER_FRUIT_SIZE = 200;

export function growFruits(seed: string, branches: readonly BranchV1[], growth: number): FruitV1[] {
  const count = 1 + Math.floor(growth / GROWTH_PER_FRUIT);

  return Array.from({ length: count }, (_, index) => fruit(seed, branches, growth, index));
}

function fruit(
  seed: string,
  branches: readonly BranchV1[],
  growth: number,
  index: number,
): FruitV1 {
  const key = String(index);

  return {
    id: `fruit${key}`,
    branchId: rendezvousHost(branches, seed, 'fruit', key),
    position: randomFor(seed, 'fruit', key).int(400, 950),
    size: 4 + Math.floor(growth / GROWTH_PER_FRUIT_SIZE),
  };
}
