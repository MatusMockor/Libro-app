import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import type { IdentityRepository } from '../application/identity-repository.js';
import type { IdentityLink, IdentityLinkResult, ProviderIdentity } from '../domain/identity.js';
import type { User } from '../domain/user.js';
import { IdentityEntity } from './identity.entity.js';

const LOCK_IDENTITY = `
  SELECT pg_advisory_xact_lock(hashtextextended('auth.identities/' || $1::text || '/' || $2::text, 0))
`;

const SELECT_USER_OF_IDENTITY = `
  SELECT users.id, users.email
  FROM auth.identities AS identity
  JOIN auth.users AS users ON users.id = identity.user_id
  WHERE identity.provider = $1 AND identity.subject = $2
`;

const INSERT_USER_WITHOUT_PASSWORD = `
  INSERT INTO auth.users (email) VALUES ($1)
  ON CONFLICT ON CONSTRAINT users_email_key DO NOTHING
  RETURNING id, email
`;

const SELECT_USER_BY_EMAIL = `
  SELECT id, email FROM auth.users WHERE email = $1 FOR KEY SHARE
`;

const INSERT_IDENTITY = `
  INSERT INTO auth.identities (provider, subject, user_id) VALUES ($1, $2, $3)
  ON CONFLICT DO NOTHING
  RETURNING id
`;

const USER_LOOKUP_ATTEMPTS = 3;

const CONFLICT: IdentityLinkResult = { kind: 'conflict' };

const EXISTING_ACCOUNT: IdentityLinkResult = { kind: 'existing_account' };

interface UserForEmail {
  readonly user: User;
  readonly created: boolean;
}

@Injectable()
export class TypeOrmIdentityRepository implements IdentityRepository {
  constructor(
    @InjectRepository(IdentityEntity) private readonly identities: Repository<IdentityEntity>,
  ) {}

  async findUser({ provider, subject }: ProviderIdentity): Promise<User | undefined> {
    const [user] = await this.identities.query<User[]>(SELECT_USER_OF_IDENTITY, [
      provider,
      subject,
    ]);

    return user;
  }

  link(link: IdentityLink): Promise<IdentityLinkResult> {
    return this.identities.manager.transaction(async (manager) => {
      await manager.query(LOCK_IDENTITY, [link.provider, link.subject]);

      const [linkedUser] = await manager.query<User[]>(SELECT_USER_OF_IDENTITY, [
        link.provider,
        link.subject,
      ]);
      if (linkedUser) {
        return { kind: 'signed_in', user: linkedUser };
      }

      const account = await userForEmail(manager, link.email);
      if (!account) {
        return CONFLICT;
      }

      if (!account.created && !link.mayLinkExistingAccount) {
        return EXISTING_ACCOUNT;
      }

      const [identity] = await manager.query<{ id: string }[]>(INSERT_IDENTITY, [
        link.provider,
        link.subject,
        account.user.id,
      ]);
      if (!identity) {
        return CONFLICT;
      }

      return { kind: account.created ? 'created' : 'linked', user: account.user };
    });
  }
}

async function userForEmail(
  manager: EntityManager,
  email: string,
): Promise<UserForEmail | undefined> {
  for (let attempt = 1; attempt <= USER_LOOKUP_ATTEMPTS; attempt += 1) {
    const [created] = await manager.query<User[]>(INSERT_USER_WITHOUT_PASSWORD, [email]);
    if (created) {
      return { user: created, created: true };
    }

    const [existing] = await manager.query<User[]>(SELECT_USER_BY_EMAIL, [email]);
    if (existing) {
      return { user: existing, created: false };
    }
  }

  return undefined;
}
