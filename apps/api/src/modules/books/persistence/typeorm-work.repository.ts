import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../../../database/unique-violation.js';
import { IsbnAlreadyExistsException } from '../application/isbn-already-exists.exception.js';
import type { WorkRepository } from '../application/work-repository.js';
import type { WorkSummary } from '../domain/book-search.js';
import type { NewWork, Work } from '../domain/work.js';
import { EDITIONS_ISBN13_KEY } from './edition.entity.js';
import { toWork, toWorkEntity } from './work.mapper.js';
import { WorkEntity } from './work.entity.js';

const DETAIL_RELATIONS = { workAuthors: { author: true }, editions: true };

const SELECT_SUMMARIES = `
  SELECT
    works.id,
    works.title,
    coalesce(
      json_agg(json_build_object('id', authors.id, 'name', authors.name) ORDER BY work_authors.position)
        FILTER (WHERE authors.id IS NOT NULL),
      '[]'
    ) AS authors
  FROM books.works
  LEFT JOIN books.work_authors ON work_authors.work_id = works.id
  LEFT JOIN books.authors ON authors.id = work_authors.author_id
  WHERE works.id = ANY ($1::uuid[])
  GROUP BY works.id, works.title
`;

@Injectable()
export class TypeOrmWorkRepository implements WorkRepository {
  constructor(@InjectRepository(WorkEntity) private readonly works: Repository<WorkEntity>) {}

  async add(work: NewWork): Promise<Work> {
    try {
      const saved = await this.works.manager.transaction((manager) =>
        manager.save(toWorkEntity(work)),
      );

      return toWork(saved);
    } catch (error) {
      if (isUniqueViolation(error, EDITIONS_ISBN13_KEY)) {
        throw new IsbnAlreadyExistsException();
      }

      throw error;
    }
  }

  async findById(workId: string): Promise<Work | undefined> {
    const work = await this.works.findOne({ where: { id: workId }, relations: DETAIL_RELATIONS });

    return work ? toWork(work) : undefined;
  }

  exists(workId: string): Promise<boolean> {
    return this.works.existsBy({ id: workId });
  }

  findSummaries(workIds: readonly string[]): Promise<WorkSummary[]> {
    return this.works.query<WorkSummary[]>(SELECT_SUMMARIES, [workIds]);
  }
}
