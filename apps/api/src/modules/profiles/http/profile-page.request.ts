import { z } from 'zod';
import { PROFILE_PAGE_MAX_OFFSET } from '../domain/profile-page.js';

const pageFields = {
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(PROFILE_PAGE_MAX_OFFSET).default(0),
};

export const profilePageQuerySchema = z.object(pageFields);

export const searchProfilesQuerySchema = z.object({
  q: z.string().trim().min(2).max(50).meta({
    description:
      'Words found in the handle or the display name, case and diacritics ignored; a leading @ is ignored',
    example: 'jana',
  }),
  ...pageFields,
});

export type ProfilePageQuery = z.infer<typeof profilePageQuerySchema>;

export type SearchProfilesQuery = z.infer<typeof searchProfilesQuerySchema>;
