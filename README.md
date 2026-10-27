# read more (Libro app)

Monorepo for "read more", a calm, book-only social app for readers, starting from the Libro Club community. See [CLAUDE.md](CLAUDE.md) for the product, architecture and development rules.

## Layout

| Path                 | What                                                       |
| -------------------- | ---------------------------------------------------------- |
| `apps/api`           | Backend - NestJS modular monolith                          |
| `packages/`          | Shared packages (tree engine, API contracts) - none yet    |
| `docker/postgres`    | Local Postgres image (PostGIS + pgvector) and init scripts |
| `docker-compose.yml` | Local dev environment (Postgres + api with hot reload)     |
| `turbo.json`         | Task pipeline for `lint`, `typecheck`, `test`, `dev`       |
| `tsconfig.base.json` | Shared strict TypeScript config                            |
| `eslint.config.js`   | Shared ESLint flat config                                  |

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

## Database

The Postgres image is the official `postgis/postgis` image with the `pgvector` package added. On the first start of an empty volume it creates:

- database `libro_app` owned by user `libro_app`
- database `libro_app_test` for tests

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

Tests run with `NODE_ENV=test` and safe defaults from `apps/api/vitest.config.ts`. Create an optional `.env.test` in the root to override them.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

`lint`, `typecheck` and `test` run through Turborepo in every workspace package.

`pnpm test` needs Postgres: run `pnpm db:up` first. Tests use only the `libro_app_test` database (the Vitest config refuses any database whose name does not end with `_test`), never the dev database `libro_app`. The migration test runs, reverts and re-applies every migration there and leaves it migrated. This is temporary until tests get their own Postgres via Testcontainers (LIB-17).

The same checks run in CI (`.github/workflows/ci.yml`) on every pull request and every push to `main`. CI also starts the same Postgres image as `pnpm db:up`, runs the tests against it, then runs `pnpm db:migrate`, `pnpm db:migration:check` (fails when an entity changed without a migration) and `pnpm db:seed`. A pull request can be merged only when CI is green.
