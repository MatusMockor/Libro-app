import { z } from 'zod';
import { TREE_PAGE_MAX_OFFSET } from '../domain/reading-tree.js';

export const treePageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(20),
  offset: z.coerce.number().int().min(0).max(TREE_PAGE_MAX_OFFSET).default(0),
});

export type TreePageRequest = z.infer<typeof treePageQuerySchema>;
