import type { WorkSummary } from './domain/book-search.js';

export const BOOK_CATALOGUE = Symbol('BOOK_CATALOGUE');

export const MAX_WORK_SUMMARIES_PER_CALL = 100;

export interface BookCatalogue {
  workExists(workId: string): Promise<boolean>;
  findWorkSummaries(workIds: readonly string[]): Promise<ReadonlyMap<string, WorkSummary>>;
}
