import type { DataSource, QueryRunner } from 'typeorm';

const POLL_INTERVAL_MS = 10;
const MAX_POLLS = 500;

const WAITING_FOR_SESSION_LOCK = `
  SELECT count(*)::int AS waiting
  FROM pg_stat_activity
  WHERE datname = current_database()
    AND pid <> pg_backend_pid()
    AND wait_event_type = 'Lock'
    AND query LIKE '%FOR UPDATE OF session%'
`;

export interface SessionLock {
  readonly connection: QueryRunner;
  commit(): Promise<void>;
}

export async function lockSession(dataSource: DataSource, sessionId: string): Promise<SessionLock> {
  const connection = dataSource.createQueryRunner();
  await connection.connect();
  await connection.startTransaction();
  await connection.query('SELECT id FROM auth.sessions WHERE id = $1 FOR UPDATE', [sessionId]);

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
): Promise<number> {
  let waiting = 0;
  for (let poll = 0; poll < MAX_POLLS && waiting < expected; poll += 1) {
    const [row] = await dataSource.query<{ waiting: number }[]>(WAITING_FOR_SESSION_LOCK);
    waiting = row?.waiting ?? 0;
    if (waiting < expected) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  return waiting;
}
