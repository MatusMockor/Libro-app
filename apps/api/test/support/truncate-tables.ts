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
  ORDER BY name
`;

export async function userTables(
  dataSource: DataSource,
  excluded: readonly string[],
): Promise<string[]> {
  const tables = await dataSource.query<{ name: string }[]>(USER_TABLES, [excluded]);

  return tables.map(({ name }) => name);
}

export async function truncateAllTables(dataSource: DataSource): Promise<void> {
  const tables = await userTables(dataSource, KEPT_TABLES);

  if (tables.length === 0) {
    return;
  }

  await dataSource.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
}
