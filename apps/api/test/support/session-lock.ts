import type { DataSource, QueryRunner } from 'typeorm';

const POLL_INTERVAL_MS = 10;
const MAX_POLLS = 500;

const AUTH_SESSION_QUERY = '%FOR UPDATE OF session%';

const WAITING_FOR_SESSION_LOCK = `
  SELECT count(*)::int AS waiting
  FROM pg_stat_activity
  WHERE datname = current_database()
    AND pid <> pg_backend_pid()
    AND wait_event_type = 'Lock'
    AND query LIKE $1
`;

export type SessionTable = 'auth.sessions' | 'reading.sessions';

export type RowLockMode = 'UPDATE' | 'SHARE';

export interface SessionLockOptions {
  readonly table?: SessionTable;
  readonly mode?: RowLockMode;
}

export interface SessionLock {
  readonly connection: QueryRunner;
  commit(): Promise<void>;
}

export async function lockSession(
  dataSource: DataSource,
  sessionId: string,
  { table = 'auth.sessions', mode = 'UPDATE' }: SessionLockOptions = {},
): Promise<SessionLock> {
  const connection = dataSource.createQueryRunner();
  await connection.connect();
  await connection.startTransaction();
  await connection.query(`SELECT id FROM ${table} WHERE id = $1 FOR ${mode}`, [sessionId]);

  return {
    connection,
    commit: async () => {
      await connection.commitTransaction();
      await connection.release();
    },
  };
}

export async function requestsWaitingForSessionLock(
  dataSource: DataSource,
  expected: number,
  queryPattern = AUTH_SESSION_QUERY,
): Promise<number> {
  let waiting = 0;
  for (let poll = 0; poll < MAX_POLLS && waiting < expected; poll += 1) {
    const [row] = await dataSource.query<{ waiting: number }[]>(WAITING_FOR_SESSION_LOCK, [
      queryPattern,
    ]);
    waiting = row?.waiting ?? 0;
    if (waiting < expected) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  return waiting;
}
