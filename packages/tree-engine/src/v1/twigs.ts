import type { CountedPart, CountedSession } from './counting.ts';
import { type HostedSlot, hostedSlots } from './hosting.ts';
import { childId } from './ids.ts';
import { TWIGS_PER_BRANCH } from './limits.ts';
import { scale } from './numbers.ts';
import { randomFor } from './random.ts';
import type { BranchV1 } from './types.ts';

export function growTwigs(
  seed: string,
  sessions: readonly CountedSession[],
  branches: readonly BranchV1[],
): BranchV1[] {
  return hostedSlots(sessions, branches, TWIGS_PER_BRANCH, (session) => session.skipped).map(
    (slot) => twig(seed, slot),
  );
}

function twig(seed: string, { host, index, detail }: HostedSlot<CountedPart>): BranchV1 {
  const random = randomFor(seed, 'twig', host.id, String(index));
  const position = random.int(200, 900);
  const angle = random.sign() * random.int(35, 75);
  const reach = 250 + 40 * detail.spanBonus + random.int(0, 100);

  return {
    id: childId(host.id, 't', index),
    parentId: host.id,
    position,
    angle,
    length: Math.max(2, scale(host.length, reach)),
    thickness: Math.max(1, scale(host.thickness, 350)),
    bare: true,
  };
}
