import type { CountedSession } from './counting.ts';
import { type HostedSlot, hostedSlots } from './hosting.ts';
import { childId } from './ids.ts';
import { BASE_LEAVES_PER_BRANCH, SLOW_LEAVES_PER_BRANCH } from './limits.ts';
import { randomFor } from './random.ts';
import type { BranchV1, LeafV1 } from './types.ts';

const BASE_LEAVES = 2;
const VIGOUR_PER_EXTRA_LEAF = 250;
const LEAVES_PER_SLOW_PART = 2;
const GROWTH_PER_LEAF_SIZE = 250;

interface Foliage {
  readonly prefix: string;
  readonly budgetPerHost: number;
  readonly countOf: (session: CountedSession, room: number) => number;
}

const BASE_FOLIAGE: Foliage = {
  prefix: 'l',
  budgetPerHost: BASE_LEAVES_PER_BRANCH,
  countOf: (session) => BASE_LEAVES + Math.floor(session.vigour / VIGOUR_PER_EXTRA_LEAF),
};

const SLOW_FOLIAGE: Foliage = {
  prefix: 's',
  budgetPerHost: SLOW_LEAVES_PER_BRANCH,
  countOf: slowLeafCount,
};

export function growLeaves(
  seed: string,
  sessions: readonly CountedSession[],
  branches: readonly BranchV1[],
  growth: number,
): LeafV1[] {
  return [BASE_FOLIAGE, SLOW_FOLIAGE].flatMap((foliage) =>
    hostedSlots(sessions, branches, foliage.budgetPerHost, (session, room) =>
      Array.from({ length: Math.min(foliage.countOf(session, room), room) }, () => null),
    ).map((slot) => leaf(seed, foliage.prefix, slot, growth)),
  );
}

function slowLeafCount(session: CountedSession, room: number): number {
  let count = 0;

  for (const part of session.slow) {
    if (count >= room) {
      return count;
    }

    count += LEAVES_PER_SLOW_PART + part.spanBonus;
  }

  return count;
}

function leaf(
  seed: string,
  prefix: string,
  { host, index }: HostedSlot<null>,
  growth: number,
): LeafV1 {
  const id = childId(host.id, prefix, index);
  const random = randomFor(seed, 'leaf', id);
  const position = random.int(250, 1000);

  return {
    id,
    branchId: host.id,
    position,
    size: 3 + Math.floor(growth / GROWTH_PER_LEAF_SIZE) + random.int(0, 2),
  };
}
