import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import type {
  NewSession,
  RotationResult,
  SessionRepository,
  TokenRotation,
} from '../application/session-repository.js';
import { RefreshTokenEntity } from './refresh-token.entity.js';
import { SessionEntity } from './session.entity.js';

const LOCK_SESSION_OF_TOKEN = `
  SELECT session.id AS "sessionId"
  FROM auth.refresh_tokens AS token
  JOIN auth.sessions AS session ON session.id = token.session_id
  WHERE token.token_hash = $1
  FOR UPDATE OF session
`;

const CONSUME_ACTIVE_TOKEN = `
  UPDATE auth.refresh_tokens AS token
  SET revoked_at = clock_timestamp()
  FROM auth.sessions AS session
  WHERE token.token_hash = $1
    AND token.revoked_at IS NULL
    AND session.id = token.session_id
    AND session.revoked_at IS NULL
    AND session.expires_at > clock_timestamp()
  RETURNING session.user_id AS "userId", session.expires_at AS "expiresAt"
`;

const INSERT_REPLACEMENT = `
  INSERT INTO auth.refresh_tokens (session_id, token_hash) VALUES ($1, $2)
`;

const REVOKE_SESSION_OF_REUSED_TOKEN = `
  UPDATE auth.sessions AS session
  SET revoked_at = clock_timestamp()
  FROM auth.refresh_tokens AS token
  WHERE token.token_hash = $1
    AND token.revoked_at IS NOT NULL
    AND session.id = token.session_id
    AND session.revoked_at IS NULL
  RETURNING session.id AS "sessionId"
`;

const REVOKE_SESSION = `
  UPDATE auth.sessions SET revoked_at = clock_timestamp() WHERE id = $1 AND revoked_at IS NULL
`;

interface ConsumedToken {
  readonly userId: string;
  readonly expiresAt: Date;
}

type UpdateResult<TRow> = [TRow[], number];

const REJECTED: RotationResult = { kind: 'rejected' };

@Injectable()
export class TypeOrmSessionRepository implements SessionRepository {
  constructor(
    @InjectRepository(SessionEntity) private readonly sessions: Repository<SessionEntity>,
  ) {}

  async start({ userId, expiresAt, refreshTokenHash }: NewSession): Promise<void> {
    const session = Object.assign(new SessionEntity(), {
      userId,
      expiresAt,
      refreshTokens: [Object.assign(new RefreshTokenEntity(), { tokenHash: refreshTokenHash })],
    });

    await this.sessions.manager.transaction((manager) => manager.save(session));
  }

  rotate(rotation: TokenRotation): Promise<RotationResult> {
    return this.sessions.manager.transaction(async (manager) => {
      const sessionId = await lockSessionOfToken(manager, rotation.presentedHash);
      if (!sessionId) {
        return REJECTED;
      }

      const consumed = await consumeActiveToken(manager, rotation.presentedHash);
      if (!consumed) {
        return revokeSessionOfReusedToken(manager, rotation.presentedHash);
      }

      await manager.query(INSERT_REPLACEMENT, [sessionId, rotation.replacementHash]);
      return { kind: 'rotated', userId: consumed.userId, expiresAt: consumed.expiresAt };
    });
  }

  async revokeByToken(tokenHash: string): Promise<void> {
    await this.sessions.manager.transaction(async (manager) => {
      const sessionId = await lockSessionOfToken(manager, tokenHash);
      if (!sessionId) {
        return;
      }

      await manager.query(REVOKE_SESSION, [sessionId]);
    });
  }
}

async function lockSessionOfToken(
  manager: EntityManager,
  tokenHash: string,
): Promise<string | undefined> {
  const [locked] = await manager.query<{ sessionId: string }[]>(LOCK_SESSION_OF_TOKEN, [tokenHash]);

  return locked?.sessionId;
}

async function consumeActiveToken(
  manager: EntityManager,
  tokenHash: string,
): Promise<ConsumedToken | undefined> {
  const [rows] = await manager.query<UpdateResult<ConsumedToken>>(CONSUME_ACTIVE_TOKEN, [
    tokenHash,
  ]);
  const [consumed, ...others] = rows;

  return others.length === 0 ? consumed : undefined;
}

async function revokeSessionOfReusedToken(
  manager: EntityManager,
  tokenHash: string,
): Promise<RotationResult> {
  const [rows] = await manager.query<UpdateResult<{ sessionId: string }>>(
    REVOKE_SESSION_OF_REUSED_TOKEN,
    [tokenHash],
  );
  const [revoked] = rows;

  return revoked ? { kind: 'reused', sessionId: revoked.sessionId } : REJECTED;
}
