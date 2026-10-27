# read more (Libro app)

Monorepo for "read more", a calm, book-only social app for readers, starting from the Libro Club community. See [CLAUDE.md](CLAUDE.md) for the product, architecture and development rules.

## Layout

| Path                 | What                                                      |
| -------------------- | --------------------------------------------------------- |
| `apps/api`           | Backend - NestJS modular monolith                         |
| `packages/`          | Shared packages (tree engine, API contracts) - none yet   |
| `docker/postgres`    | Postgres image (PostGIS + pgvector) for dev, CI and tests |
| `docker-compose.yml` | Local dev environment (Postgres + api with hot reload)    |
| `turbo.json`         | Task pipeline for `lint`, `typecheck`, `test`, `dev`      |
| `tsconfig.base.json` | Shared strict TypeScript config                           |
| `eslint.config.js`   | Shared ESLint flat config                                 |

## Prerequisites

- Node.js `^24.11` or `>=26`
- pnpm `10.34.5` (see `packageManager` in `package.json`)
- Docker with Compose v2.32+ (`docker compose watch` with the `restart` action, `env_file` with `required`)

## Setup

```sh
pnpm install
cp .env.example .env
```

Every variable is documented in `.env.example`. The defaults are safe local-only values.

## Run locally (Docker)

```sh
pnpm dev
```

Builds the images, starts Postgres and the api, and keeps watching:

- `apps/api/src`, `tsconfig*.json` and `nest-cli.json` are bind-mounted read-only into the container, so it always runs the current host source, also after the container is recreated
- changes in `apps/api/src` are picked up by Nest in watch mode (no image rebuild, no container restart)
- changes in `tsconfig*.json` / `nest-cli.json` restart the container
- changes in `package.json` / `pnpm-lock.yaml` rebuild the api image

`node_modules` are never mounted from the host. The container uses the ones installed in the image.

Endpoints (all bound to `127.0.0.1` only):

| What             | Default                        | Variable         |
| ---------------- | ------------------------------ | ---------------- |
| api health check | `http://127.0.0.1:3000/health` | `API_PORT`       |
| Node inspector   | `127.0.0.1:9229`               | `API_DEBUG_PORT` |
| Postgres         | `127.0.0.1:5433`               | `DB_PORT`        |

Other scripts:

| Script             | What it does                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm dev:restart` | Recreates the containers so they pick up a changed `.env` (no image rebuild). See the note below for `POSTGRES_*` |
| `pnpm db:up`       | Starts only Postgres and waits until it is healthy                                                                |
| `pnpm db:down`     | Stops and removes this project's containers and network, keeps the data volume                                    |
| `pnpm db:reset`    | Same as `db:down` plus removes the `libro-app-pgdata` volume, then starts Postgres                                |
| `pnpm dev:host`    | Runs the api on the host in watch mode (expects Postgres from `pnpm db:up`)                                       |

`POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` are used only when Postgres initializes an empty data directory. Changing them after the `libro-app-pgdata` volume was initialized is not applied by `pnpm dev:restart`: the database keeps the old user, password and database, while the api gets a `DATABASE_URL` built from the new values and cannot connect. Either reset the volume with `pnpm db:reset` (deletes all local data) or change the user / password inside the existing database (for example `ALTER USER ... PASSWORD ...` via `psql`).

## Isolation from other Docker projects

Everything is namespaced under the compose project `libro-app`: containers `libro-app-postgres` and `libro-app-api`, network `libro-app_default`, volume `libro-app-pgdata`. Host ports are bound to `127.0.0.1` and never use `5432`. `db:reset` removes only `libro-app-pgdata`; no script runs global Docker commands such as `prune`.

`pnpm test` adds its own resources through Testcontainers (see [Testing](#testing)): the image `libro-app-postgres:test`, which is kept as a build cache, a Postgres container with a random name and a random host port, and the Testcontainers reaper (`testcontainers-ryuk-*`). The containers carry the label `org.testcontainers=true`, the Postgres data lives in a `tmpfs`, and both containers are removed when the run ends, also when it crashes (the reaper removes what is left and exits a few seconds after the test process).

## Database

The Postgres image is the official `postgis/postgis` image with the `pgvector` package added. On the first start of an empty volume it creates the database `libro_app` owned by user `libro_app`. Tests do not use it, they run against their own container (see [Testing](#testing)).

The `postgis` and `vector` packages are installed in the image, but no extension is enabled by the image. Extensions are enabled only by migrations (see below).

## Migrations and seeds

The backend uses TypeORM 1.x in repository mode (`TypeOrmModule.forFeature` + `@InjectRepository`). There is one data source definition in `apps/api/src/database/data-source.options.ts`:

- `dataSourceOptions(url)` - shared by the api (`DatabaseModule`, `TypeOrmModule.forRootAsync` with `DATABASE_URL` from `ConfigService`) and the CLI. `synchronize` is always `false`, in every environment; the schema changes only through migrations.
- `cliDataSourceOptions(url)` - the same options plus the entity, seeder and factory globs, used by the CLI entry `apps/api/src/database/data-source.ts`.

Discovery, all relative to `apps/api/src` (the api registers entities through `forFeature` with `autoLoadEntities`, the CLI finds them by glob):

| What       | Pattern                     | Example                                                 |
| ---------- | --------------------------- | ------------------------------------------------------- |
| Entities   | `**/*.entity.ts`            | `modules/books/book.entity.ts`                          |
| Migrations | `**/migrations/*.ts`        | `database/migrations/1793115072337-EnableExtensions.ts` |
| Seeders    | `**/seeds/*.seeder.ts`      | `modules/books/seeds/books.seeder.ts`                   |
| Factories  | `**/factories/*.factory.ts` | `modules/books/factories/book.factory.ts`               |

A new module under `apps/api/src/modules/<module>/` is picked up without touching any central config.

Scripts (run from the repository root, against `DATABASE_URL` from the root `.env`, so start Postgres with `pnpm db:up` first):

| Script                              | What it does                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm db:migrate`                   | Runs all pending migrations                                                                         |
| `pnpm db:migrate:revert`            | Reverts the last executed migration                                                                 |
| `pnpm db:migration:generate <Name>` | Generates `apps/api/src/database/migrations/<timestamp>-<Name>.ts` from the entity / schema diff    |
| `pnpm db:migration:create <Name>`   | Creates an empty migration in the same folder (for data migrations or hand-written SQL)             |
| `pnpm db:migration:check`           | Fails when the entities differ from the migrated database, i.e. a migration is missing (used in CI) |
| `pnpm db:seed`                      | Runs all seeders (`typeorm-extension`)                                                              |

`generate` and `create` format the new file with Prettier. Review a generated migration before committing it: every migration needs a working `down()` that fully reverts `up()`.

The CLI runs the TypeScript sources directly. Node's built-in type stripping cannot run decorators, so the scripts load [`@oxc-node/core`](https://github.com/oxc-project/oxc-node) (`node --import @oxc-node/core/register`), which uses the same Oxc transformer as Vitest and supports `emitDecoratorMetadata`. The CLI reads the same env files as the api (`.env.local`, `.env`, or `.env.test` with `NODE_ENV=test`), real environment variables win, and validates them with the same schema.

Where things live:

- **Extensions** (`postgis`, `vector`, `unaccent`, `pg_trgm`) are enabled by the first migration in the `public` schema, so their types and functions (`geometry`, `vector`, `unaccent()`, `similarity()`) resolve from every module schema without `search_path` changes. TypeORM's automatic extension install (`installExtensions`) is off, so no extension appears outside a migration. UUID defaults use the built-in `gen_random_uuid()` (`uuidExtension: 'pgcrypto'`, no extension needed on Postgres 13+).
- **The migrations table** is TypeORM's default `public.migrations`. It is shared infrastructure, not owned by any module.

### Schema per module

Each module owns its own Postgres schema, named after the module:

1. Every entity of the module declares it: `@Entity({ schema: 'books', name: 'books' })`.
2. The module's first migration creates the schema before its tables: `await queryRunner.createSchema('books', true);`. TypeORM does not generate this line, add it by hand after `db:migration:generate`.
3. Its `down()` drops the schema after dropping the tables: `await queryRunner.dropSchema('books');`.

Foreign keys, unique constraints and `ON DELETE` rules stay inside a module schema. No foreign key points into another module's schema.

### Seeders and factories

Seeders and factories use [`typeorm-extension`](https://github.com/tada5hi/typeorm-extension). A seeder is a default-exported class implementing `Seeder` in a `seeds/*.seeder.ts` file; a factory is a default-exported `setSeederFactory(...)` in a `factories/*.factory.ts` file. There are no seeders yet, so `pnpm db:seed` currently runs nothing and succeeds.

## Environment and configuration

Configuration comes only from environment variables, validated at startup. The api refuses to start with a readable error listing every broken variable, for example:

```text
Config validation error: PORT: must be a number
DATABASE_URL: must be a postgres:// or postgresql:// connection URL
```

Files loaded by the api (real environment variables always win). The file set is chosen from `NODE_ENV` of the process environment (exported in the shell or set by the test runner) before any file is read, so `NODE_ENV=test` written inside `.env` does not make the api load `.env.test`. Run it as `NODE_ENV=test pnpm ...` instead.

| `NODE_ENV` (process environment) | Files, highest priority first |
| -------------------------------- | ----------------------------- |
| `test`                           | `.env.test`                   |
| anything else                    | `.env.local`, `.env`          |

All `.env*` files live in the repository root, are gitignored (except `.env.example`) and are never copied into an image. Containers get them at runtime through `env_file:`, so changing `.env` only needs `pnpm dev:restart`, never a rebuild.

`DATABASE_URL` in `.env` is the host view (`127.0.0.1:DB_PORT`). Inside Docker Compose the api gets its own `DATABASE_URL` pointing to the `postgres` service, built from `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB`.

Tests run with `NODE_ENV=test`, so the api loads an optional root `.env.test`. `DATABASE_URL` always comes from the test harness and cannot be overridden there.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

`lint`, `typecheck` and `test` run through Turborepo in every workspace package.

`pnpm test` needs only a running Docker daemon, no `pnpm db:up` and no `.env` (see [Testing](#testing)).

Turborepo caches `test` like `lint` and `typecheck`: the tests are hermetic, so a run is replayed from the cache while nothing they depend on changed (the package files, the lockfile, `tsconfig.base.json`, `docker/postgres/**` and `.env.test`). Use `pnpm test --force` to run them anyway. `DOCKER_*` and `TESTCONTAINERS_*` variables are passed through to the tests, so a non-default Docker socket (`DOCKER_HOST`) works.

The same checks run in CI (`.github/workflows/ci.yml`) on every pull request and every push to `main`. After the tests, CI starts the compose Postgres (`pnpm db:up`) and runs `pnpm db:migrate`, `pnpm db:migration:check` (fails when an entity changed without a migration) and `pnpm db:seed` against it. A pull request can be merged only when CI is green.

## Testing

Integration tests run against a real Postgres that [Testcontainers](https://node.testcontainers.org/) starts for every `pnpm test` run. The only requirement is a running Docker daemon.

How the harness in `apps/api/test/support/` works:

1. **Once per run** (`global-setup.ts`, Vitest `globalSetup`): builds `docker/postgres/Dockerfile`, the same image Docker Compose uses, as `libro-app-postgres:test` (BuildKit, so it is a cache hit after the first build), starts it with the data directory in `tmpfs`, creates the database `libro_template` and runs all migrations on it.
2. **Once per test file** (`database-per-file.setup.ts`, Vitest `setupFiles`): clones `libro_template` into a new database `test_<random>`, points `DATABASE_URL` at it before the file is imported, and drops it after the file. Test files never share a database, so they run in parallel.
3. **Once per test** (`integration-test.ts`): truncates every table in every non-system schema (with `RESTART IDENTITY CASCADE`), except the migration bookkeeping (`public.migrations`, `public.typeorm_metadata`) and tables owned by extensions (PostGIS `spatial_ref_sys`). Rows inserted by a data migration are truncated too, so a test that needs them inserts them itself.

Writing an integration test: import `test` from `./support/integration-test.js` instead of `vitest` and take what you need from its fixtures.

| Fixture      | What it is                                                                          |
| ------------ | ----------------------------------------------------------------------------------- |
| `app`        | The full Nest app (`AppModule` + `configureApp`), booted once per file              |
| `http`       | A supertest client bound to `app`                                                   |
| `dataSource` | The TypeORM `DataSource` of `app`, for arranging data and asserting on the database |

```ts
import { describe, expect } from 'vitest';
import { test } from './support/integration-test.js';

describe('GET /health', () => {
  test('reports the api as healthy', async ({ http }) => {
    const response = await http.get('/health');

    expect(response.status).toBe(200);
  });
});
```

`test.beforeAll(async ({ dataSource }) => ...)` can use the file fixtures, for example to create a test-only table. Rows inserted there are gone before the first test, because every test starts from empty tables: arrange data inside the test.

Tests that need no app (for example `config.test.ts`) use plain `vitest`; they still get their own database, which costs a few milliseconds. `migrations.test.ts` reverts and re-applies every migration through the CLI data source on its own per-file database, so it cannot affect other files.

Factories (`typeorm-extension`, `factories/*.factory.ts`) are not wired into the harness yet because there is no entity to build. The first module (LIB-18) adds them on top of the `dataSource` fixture.

A first run on a machine without the image downloads `postgis/postgis` and builds the image; later runs reuse the cached layers.
