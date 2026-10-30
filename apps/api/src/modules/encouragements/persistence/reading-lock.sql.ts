export const LOCK_READING = `
  SELECT pg_advisory_xact_lock(hashtextextended('encouragements/' || $1::text, 0))
`;
