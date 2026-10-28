import type { BookSearch, WorkSummary } from '../domain/book-search.js';

export const BOOK_SEARCH_REPOSITORY = Symbol('BOOK_SEARCH_REPOSITORY');

export interface BookSearchRepository {
  search(search: BookSearch): Promise<WorkSummary[]>;
}
