import type { CountedPart, CountedSession } from './counting.ts';
import { type HostedSlot, hostedSlots } from './hosting.ts';
import { childId } from './ids.ts';
import { FLOWERS_PER_BRANCH } from './limits.ts';
import { randomFor } from './random.ts';
import type { BranchV1, FlowerV1 } from './types.ts';

export function growFlowers(
  seed: string,
  sessions: readonly CountedSession[],
  branches: readonly BranchV1[],
): FlowerV1[] {
  return hostedSlots(sessions, branches, FLOWERS_PER_BRANCH, (session) => session.good).map(
    (slot) => flower(seed, slot),
  );
}

function flower(seed: string, { host, index, detail }: HostedSlot<CountedPart>): FlowerV1 {
  const random = randomFor(seed, 'flower', host.id, String(index));
  const position = random.int(300, 1000);

  return {
    id: childId(host.id, 'f', index),
    branchId: host.id,
    position,
    size: 3 + detail.spanBonus + random.int(0, 1),
  };
}
