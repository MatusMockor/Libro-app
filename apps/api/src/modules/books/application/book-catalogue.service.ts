import { Inject, Injectable } from '@nestjs/common';
import { distinctIdBatch } from '../../../shared/id-batch.js';
import { MAX_WORK_SUMMARIES_PER_CALL, type BookCatalogue } from '../book-catalogue.js';
import type { WorkSummary } from '../domain/book-search.js';
import type { Work } from '../domain/work.js';
import { BookNotFoundException } from './book-not-found.exception.js';
import { WORK_REPOSITORY, type WorkRepository } from './work-repository.js';

@Injectable()
export class BookCatalogueService implements BookCatalogue {
  constructor(@Inject(WORK_REPOSITORY) private readonly works: WorkRepository) {}

  async getWork(workId: string): Promise<Work> {
    const work = await this.works.findById(workId);
    if (!work) {
      throw new BookNotFoundException(workId);
    }

    return work;
  }

  workExists(workId: string): Promise<boolean> {
    return this.works.exists(workId);
  }

  async findWorkSummaries(workIds: readonly string[]): Promise<ReadonlyMap<string, WorkSummary>> {
    const distinct = distinctIdBatch(workIds, MAX_WORK_SUMMARIES_PER_CALL);
    if (distinct.length === 0) {
      return new Map();
    }

    const summaries = await this.works.findSummaries(distinct);

    return new Map(summaries.map((summary) => [summary.id, summary]));
  }
}
