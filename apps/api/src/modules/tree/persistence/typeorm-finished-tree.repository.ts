import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  FinishedTreeRepository,
  FinishedTrees,
} from '../application/finished-tree-repository.js';
import { FinishedTreeEntity } from './finished-tree.entity.js';

const INSERT_FINISHED_TREES = `
  INSERT INTO tree.finished_trees (reading_id, user_id, tree_engine_version)
  SELECT reading_id, $2, $3 FROM unnest($1::uuid[]) AS reading_id
  ON CONFLICT (reading_id) DO NOTHING
`;

const SELECT_STORED_VERSIONS = `
  SELECT reading_id AS "readingId", tree_engine_version AS "treeEngineVersion"
  FROM tree.finished_trees
  WHERE user_id = $1 AND reading_id = ANY ($2::uuid[])
`;

@Injectable()
export class TypeOrmFinishedTreeRepository implements FinishedTreeRepository {
  constructor(
    @InjectRepository(FinishedTreeEntity)
    private readonly finishedTrees: Repository<FinishedTreeEntity>,
  ) {}

  async record({ userId, readingIds, treeEngineVersion }: FinishedTrees): Promise<void> {
    await this.finishedTrees.query(INSERT_FINISHED_TREES, [readingIds, userId, treeEngineVersion]);
  }

  async storedVersions(
    userId: string,
    readingIds: readonly string[],
  ): Promise<Map<string, number>> {
    const rows = await this.finishedTrees.query<
      Pick<FinishedTreeEntity, 'readingId' | 'treeEngineVersion'>[]
    >(SELECT_STORED_VERSIONS, [userId, readingIds]);

    return new Map(rows.map(({ readingId, treeEngineVersion }) => [readingId, treeEngineVersion]));
  }
}
