import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  NewSignInNonce,
  SignInNonceRepository,
  StoredSignInNonce,
} from '../application/sign-in-nonce-repository.js';
import { SignInNonceEntity } from './sign-in-nonce.entity.js';

const EXPIRED_NONCES_REMOVED_PER_ISSUE = 100;

const ISSUE_NONCE_AND_REMOVE_EXPIRED = `
  WITH expired AS (
    DELETE FROM auth.sign_in_nonces
    WHERE nonce_hash IN (
      SELECT nonce_hash FROM auth.sign_in_nonces
      WHERE expires_at <= clock_timestamp()
      ORDER BY expires_at
      LIMIT $4
      FOR UPDATE SKIP LOCKED
    )
  )
  INSERT INTO auth.sign_in_nonces (nonce_hash, provider, expires_at)
  VALUES ($1, $2, clock_timestamp() + make_interval(secs => $3::int))
`;

const CONSUME_UNEXPIRED_NONCE = `
  DELETE FROM auth.sign_in_nonces
  WHERE nonce_hash = $1 AND provider = $2 AND expires_at > clock_timestamp()
  RETURNING nonce_hash
`;

type DeleteResult<TRow> = [TRow[], number];

@Injectable()
export class TypeOrmSignInNonceRepository implements SignInNonceRepository {
  constructor(
    @InjectRepository(SignInNonceEntity)
    private readonly nonces: Repository<SignInNonceEntity>,
  ) {}

  async issue({ hash, provider, lifetimeSeconds }: NewSignInNonce): Promise<void> {
    await this.nonces.query(ISSUE_NONCE_AND_REMOVE_EXPIRED, [
      hash,
      provider,
      lifetimeSeconds,
      EXPIRED_NONCES_REMOVED_PER_ISSUE,
    ]);
  }

  async consume({ hash, provider }: StoredSignInNonce): Promise<boolean> {
    const [, consumed] = await this.nonces.query<DeleteResult<{ nonce_hash: string }>>(
      CONSUME_UNEXPIRED_NONCE,
      [hash, provider],
    );

    return consumed === 1;
  }
}
