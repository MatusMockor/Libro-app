import { Inject, Injectable } from '@nestjs/common';
import type { BookCatalogue } from '../book-catalogue.js';
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
}
