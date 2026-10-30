import { z } from 'zod';
import { placeSchema } from './start-session.request.js';

export const joinSessionSchema = z
  .object({ place: placeSchema })
  .prefault({})
  .meta({ id: 'JoinReadingSession' });

export type JoinSessionRequest = z.infer<typeof joinSessionSchema>;
