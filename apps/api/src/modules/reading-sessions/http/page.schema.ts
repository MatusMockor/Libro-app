import { z } from 'zod';
import { FIRST_PAGE, LAST_PAGE } from '../domain/page.js';

export const pageSchema = z.int().min(FIRST_PAGE).max(LAST_PAGE);
