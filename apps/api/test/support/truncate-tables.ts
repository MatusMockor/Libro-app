import type { DataSource } from 'typeorm';

const KEPT_TABLES = ['public.migrations', 'public.typeorm_metadata'];

const USER_TABLES = `
  SELECT format('%I.%I', namespace.nspname, class.relname) AS name
  FROM pg_class class
  JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
  WHERE class.relkind IN ('r', 'p')
    AND namespace.nspname <> 'information_schema'
    AND namespace.nspname !~ '^pg_'
    AND namespace.nspname || '.' || class.relname <> ALL ($1::text[])
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend dependency
      WHERE dependency.classid = 'pg_class'::regclass
        AND dependency.objid = class.oid
        AND dependency.deptype = 'e'
    )
`;

export async function truncateAllTables(dataSource: DataSource): Promise<void> {
  const tables = await dataSource.query<{ name: string }[]>(USER_TABLES, [KEPT_TABLES]);

  if (tables.length === 0) {
    return;
  }

  const names = tables.map((table) => table.name).join(', ');
  await dataSource.query(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}
