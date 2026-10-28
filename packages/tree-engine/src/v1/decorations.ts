import { MAX_DECORATIONS } from './limits.ts';
import { randomFor } from './random.ts';
import { rendezvousHost } from './rendezvous.ts';
import type { BranchV1, DecorationInputV1, DecorationV1 } from './types.ts';

export function placeDecorations(
  seed: string,
  decorations: readonly DecorationInputV1[],
  branches: readonly BranchV1[],
): DecorationV1[] {
  return decorations
    .slice(0, MAX_DECORATIONS)
    .map((decoration) => placeDecoration(seed, decoration, branches));
}

function placeDecoration(
  seed: string,
  decoration: DecorationInputV1,
  branches: readonly BranchV1[],
): DecorationV1 {
  return {
    id: decoration.id,
    kind: decoration.kind,
    branchId: rendezvousHost(branches, seed, 'decoration', decoration.id),
    position: randomFor(seed, 'decoration', decoration.id).int(200, 950),
  };
}
