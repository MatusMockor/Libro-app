import type { Author } from './work.js';
import { ISBN13_PATTERN } from './isbn13.js';
import { isbn13FromIsbn10, isValidIsbn10 } from './isbn10.js';

export const BOOK_SEARCH_MAX_OFFSET = 1000;

const ISBN_SEPARATORS = /[\s-]/g;

export interface BookSearchQuery {
  readonly text: string;
  readonly limit: number;
  readonly offset: number;
}

export interface BookSearch extends BookSearchQuery {
  readonly isbn13: string | null;
}

export interface WorkSummary {
  readonly id: string;
  readonly title: string;
  readonly authors: readonly Author[];
}

export interface BookSearchPage {
  readonly items: readonly WorkSummary[];
  readonly nextOffset: number | null;
}

export function searchedIsbn13(text: string): string | null {
  const compact = text.replace(ISBN_SEPARATORS, '').toUpperCase();
  if (ISBN13_PATTERN.test(compact)) {
    return compact;
  }

  return isValidIsbn10(compact) ? isbn13FromIsbn10(compact) : null;
}
