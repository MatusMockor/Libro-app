import type { TreeV1 } from '@libro/tree-engine';
import { z } from 'zod';

const position = z.int().meta({ description: 'Along the parent, 0 (base) to 1000 (tip)' });

const size = z.int().meta({ description: 'Abstract units' });

const branchOrTrunk = z.string().nullable().meta({ description: 'A branch id, null = the trunk' });

const ornament = z.object({ id: z.string(), branchId: z.string(), position, size });

export const treeV1Schema = z
  .object({
    treeEngineVersion: z.literal(1),
    stage: z.enum(['seed', 'sapling', 'young', 'mature']),
    growth: z.int().meta({ description: '0 to 1000' }),
    trunk: z.object({ height: size, thickness: size }),
    branches: z.array(
      z.object({
        id: z.string(),
        parentId: branchOrTrunk,
        position,
        angle: z.int().meta({
          description: 'Whole degrees from the parent direction, negative left, positive right',
        }),
        length: size,
        thickness: size,
        bare: z.boolean(),
      }),
    ),
    leaves: z.array(ornament),
    flowers: z.array(ornament),
    fruits: z.array(z.object({ id: z.string(), branchId: branchOrTrunk, position, size })),
    decorations: z.array(
      z.object({
        id: z.string(),
        kind: z.enum(['insight', 'congratulation', 'group_reading']),
        branchId: branchOrTrunk,
        position,
      }),
    ),
    stats: z.object({
      countedSessions: z.int(),
      ignoredSessions: z.int(),
      countedSeconds: z.int(),
    }),
  })
  .meta({
    id: 'TreeV1',
    description: 'Output of tree engine version 1; render it with the same engine version',
  }) satisfies z.ZodType<TreeV1>;

export type TreeV1Response = z.infer<typeof treeV1Schema>;

export function toTreeV1Response(tree: TreeV1): TreeV1Response {
  return {
    ...tree,
    branches: [...tree.branches],
    leaves: [...tree.leaves],
    flowers: [...tree.flowers],
    fruits: [...tree.fruits],
    decorations: [...tree.decorations],
  };
}
