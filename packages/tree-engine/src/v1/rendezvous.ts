import { hashKey } from './random.ts';
import type { BranchV1 } from './types.ts';

export function rendezvousHost(
  branches: readonly BranchV1[],
  ...key: readonly string[]
): string | null {
  let best: { id: string; score: number } | null = null;

  for (const branch of branches) {
    const score = hashKey(...key, branch.id);

    if (best === null || score > best.score) {
      best = { id: branch.id, score };
    }
  }

  return best?.id ?? null;
}
