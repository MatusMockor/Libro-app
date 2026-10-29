import type { WorkSummary } from '../domain/book-search.js';
import type { NewWork, Work } from '../domain/work.js';

export const WORK_REPOSITORY = Symbol('WORK_REPOSITORY');

export interface WorkRepository {
  add(work: NewWork): Promise<Work>;
  findById(workId: string): Promise<Work | undefined>;
  exists(workId: string): Promise<boolean>;
  findSummaries(workIds: readonly string[]): Promise<WorkSummary[]>;
}
