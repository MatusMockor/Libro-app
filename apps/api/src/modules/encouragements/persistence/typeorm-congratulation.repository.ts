import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CongratulationRepository } from '../application/congratulation-repository.js';
import type { CongratulationKey, NewCongratulation } from '../domain/congratulation.js';
import { CongratulationEntity } from './congratulation.entity.js';
import { LOCK_READING } from './reading-lock.sql.js';

const INSERT_CONGRATULATION = `
  INSERT INTO encouragements.congratulations (reading_id, author_id, reader_id, created_at)
  VALUES ($1, $2, $3, clock_timestamp())
  ON CONFLICT (reading_id, author_id) DO NOTHING
  RETURNING reading_id
`;

const DELETE_CONGRATULATION = `
  DELETE FROM encouragements.congratulations WHERE reading_id = $1 AND author_id = $2
`;

@Injectable()
export class TypeOrmCongratulationRepository implements CongratulationRepository {
  constructor(
    @InjectRepository(CongratulationEntity)
    private readonly congratulations: Repository<CongratulationEntity>,
  ) {}

  add({ readingId, authorId, readerId }: NewCongratulation): Promise<boolean> {
    return this.congratulations.manager.transaction(async (manager) => {
      await manager.query(LOCK_READING, [readingId]);
      const created = await manager.query<unknown[]>(INSERT_CONGRATULATION, [
        readingId,
        authorId,
        readerId,
      ]);

      return created.length === 1;
    });
  }

  async delete({ readingId, authorId }: CongratulationKey): Promise<void> {
    await this.congratulations.query(DELETE_CONGRATULATION, [readingId, authorId]);
  }
}
