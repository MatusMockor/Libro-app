import { z } from 'zod';
import { PLACE_MAX_LENGTH } from '../domain/place.js';

export const placeSchema = z.string().trim().max(PLACE_MAX_LENGTH).nullable().default(null).meta({
  description: 'Where the reader reads, as free text; blank means no place',
  example: 'kaviareň',
});

export const startSessionSchema = z
  .object({
    workId: z.uuid().meta({ description: 'The book (work) to read' }),
    place: placeSchema,
  })
  .meta({ id: 'StartReadingSession' });

export type StartSessionRequest = z.infer<typeof startSessionSchema>;
