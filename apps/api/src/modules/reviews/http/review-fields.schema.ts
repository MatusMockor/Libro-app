import { z } from 'zod';

export const uuidSchema = z.uuid().overwrite((id) => id.toLowerCase());
