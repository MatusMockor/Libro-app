import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  DeletedAccountPage,
  DeletedAccountRepository,
} from '../application/deleted-account-repository.js';
import { DeletedAccountEntity } from './deleted-account.entity.js';

const FORGET_DELETED_BEFORE = `
  DELETE FROM auth.deleted_accounts
  WHERE deleted_at < now() - make_interval(days => $1::int)
`;

const SELECT_USER_IDS = `
  SELECT user_id AS "userId"
  FROM auth.deleted_accounts
  WHERE $1::uuid IS NULL OR user_id > $1::uuid
  ORDER BY user_id
  LIMIT $2
`;

type DeleteResult = [unknown[], number];

@Injectable()
export class TypeOrmDeletedAccountRepository implements DeletedAccountRepository {
  constructor(
    @InjectRepository(DeletedAccountEntity)
    private readonly deletedAccounts: Repository<DeletedAccountEntity>,
  ) {}

  async forgetDeletedBefore(retentionDays: number): Promise<number> {
    const [, forgotten] = await this.deletedAccounts.query<DeleteResult>(FORGET_DELETED_BEFORE, [
      retentionDays,
    ]);

    return forgotten;
  }

  async userIds({ afterUserId, limit }: DeletedAccountPage): Promise<string[]> {
    const rows = await this.deletedAccounts.query<{ userId: string }[]>(SELECT_USER_IDS, [
      afterUserId ?? null,
      limit,
    ]);

    return rows.map(({ userId }) => userId);
  }
}
