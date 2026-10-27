import pg from 'pg';

export class PostgresServer {
  constructor(private readonly url: string) {}

  databaseUrl(database: string): string {
    const url = new URL(this.url);
    url.pathname = `/${database}`;

    return url.toString();
  }

  async createDatabase(database: string): Promise<void> {
    await this.execute(`CREATE DATABASE ${pg.escapeIdentifier(database)}`);
  }

  async cloneDatabase(template: string, database: string): Promise<void> {
    await this.execute(
      `CREATE DATABASE ${pg.escapeIdentifier(database)} TEMPLATE ${pg.escapeIdentifier(template)}`,
    );
  }

  async markAsTemplate(database: string): Promise<void> {
    await this.execute(
      `ALTER DATABASE ${pg.escapeIdentifier(database)} WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`,
    );
  }

  async dropDatabase(database: string): Promise<void> {
    await this.execute(`DROP DATABASE ${pg.escapeIdentifier(database)} WITH (FORCE)`);
  }

  async refuseConnections(database: string): Promise<void> {
    await this.execute(
      `ALTER DATABASE ${pg.escapeIdentifier(database)} WITH ALLOW_CONNECTIONS false`,
    );
    await this.execute(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [database],
    );
  }

  async allowConnections(database: string): Promise<void> {
    await this.execute(
      `ALTER DATABASE ${pg.escapeIdentifier(database)} WITH ALLOW_CONNECTIONS true`,
    );
  }

  private async execute(sql: string, values: unknown[] = []): Promise<void> {
    const client = new pg.Client({ connectionString: this.url });
    await client.connect();

    try {
      await client.query(sql, values);
    } finally {
      await client.end();
    }
  }
}
