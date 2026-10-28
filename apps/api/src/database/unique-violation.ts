import pg from 'pg';
import { QueryFailedError } from 'typeorm';

const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    error instanceof QueryFailedError &&
    error.driverError instanceof pg.DatabaseError &&
    error.driverError.code === UNIQUE_VIOLATION &&
    error.driverError.constraint === constraint
  );
}
