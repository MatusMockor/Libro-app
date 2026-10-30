import pg from 'pg';
import { QueryFailedError } from 'typeorm';

const DEADLOCK_DETECTED = '40P01';

export const DEADLOCK_RETRY_ATTEMPTS = 3;

export function isDeadlock(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    error.driverError instanceof pg.DatabaseError &&
    error.driverError.code === DEADLOCK_DETECTED
  );
}

export async function retryOnDeadlock<TResult>(
  attempts: number,
  work: () => Promise<TResult>,
): Promise<TResult> {
  try {
    return await work();
  } catch (error) {
    if (attempts <= 1 || !isDeadlock(error)) {
      throw error;
    }

    return retryOnDeadlock(attempts - 1, work);
  }
}
