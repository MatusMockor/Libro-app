import { growBranches } from './branches.ts';
import { countSessions } from './counting.ts';
import { placeDecorations } from './decorations.ts';
import { growFlowers } from './flowers.ts';
import { growFruits } from './fruits.ts';
import { growthFor, stageFor, trunkFor } from './growth.ts';
import { growLeaves } from './leaves.ts';
import { growTwigs } from './twigs.ts';
import type { TreeInputV1, TreeV1 } from './types.ts';

export function computeTreeV1(input: TreeInputV1): TreeV1 {
  const { counted, ignored, countedSeconds } = countSessions(input.sessions);
  const growth = growthFor(countedSeconds);
  const trunk = trunkFor(growth);
  const branches = growBranches(input.seed, counted, trunk);

  return {
    treeEngineVersion: 1,
    stage: stageFor(counted.length, growth),
    growth,
    trunk,
    branches: [...branches, ...growTwigs(input.seed, counted, branches)],
    leaves: growLeaves(input.seed, counted, branches, growth),
    flowers: growFlowers(input.seed, counted, branches),
    fruits: input.finished ? growFruits(input.seed, branches, growth) : [],
    decorations: placeDecorations(input.seed, input.decorations, branches),
    stats: { countedSessions: counted.length, ignoredSessions: ignored, countedSeconds },
  };
}
