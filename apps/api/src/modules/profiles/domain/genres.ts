export const GENRES = [
  'fantasy',
  'science_fiction',
  'crime',
  'thriller',
  'romance',
  'literary_fiction',
  'classics',
  'historical_fiction',
  'horror',
  'poetry',
  'drama',
  'biography',
  'history',
  'philosophy',
  'psychology',
  'self_help',
  'science',
  'travel',
  'children',
  'young_adult',
  'comics',
  'non_fiction_other',
] as const;

export type Genre = (typeof GENRES)[number];

export const MAX_FAVOURITE_GENRES = 10;

const KNOWN_GENRES: ReadonlySet<string> = new Set(GENRES);

export function isGenre(value: string): value is Genre {
  return KNOWN_GENRES.has(value);
}
