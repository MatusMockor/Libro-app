import { resolve } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer } from 'testcontainers';
import { WORKSPACE_ROOT } from '../../src/config/env-file-paths.js';

const POSTGRES_IMAGE = 'libro-app-postgres:test';
const POSTGRES_BUILD_CONTEXT = resolve(WORKSPACE_ROOT, 'docker/postgres');

export async function startPostgresContainer(): Promise<StartedPostgreSqlContainer> {
  await GenericContainer.fromDockerfile(POSTGRES_BUILD_CONTEXT)
    .withBuildkit()
    .build(POSTGRES_IMAGE, { deleteOnExit: false });

  return new PostgreSqlContainer(POSTGRES_IMAGE).withTmpFs({ '/var/lib/postgresql': 'rw' }).start();
}
