import { z } from 'zod';
import { LIVE_PAGE_MAX_OFFSET } from '../domain/reading-group.js';

export const livePageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(LIVE_PAGE_MAX_OFFSET).default(0),
});

export type LivePageRequest = z.infer<typeof livePageQuerySchema>;
