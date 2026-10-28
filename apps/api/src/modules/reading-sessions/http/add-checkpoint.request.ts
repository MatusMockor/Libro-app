import { z } from 'zod';
import { pageSchema } from './page.schema.js';

export const addCheckpointSchema = z
  .object({
    page: pageSchema.meta({ description: 'The page the reader is on' }),
  })
  .meta({ id: 'AddCheckpoint' });

export type AddCheckpointRequest = z.infer<typeof addCheckpointSchema>;
