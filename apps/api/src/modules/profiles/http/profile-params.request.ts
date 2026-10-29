import { z } from 'zod';
import { handleSchema, uuidSchema } from './profile-fields.schema.js';

export const profileParamsSchema = z.object({
  userId: uuidSchema,
});

export const handleParamsSchema = z.object({
  handle: handleSchema,
});

export type ProfileParams = z.infer<typeof profileParamsSchema>;

export type HandleParams = z.infer<typeof handleParamsSchema>;
