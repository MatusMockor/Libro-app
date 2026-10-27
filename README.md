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

The `postgis` and `vector` extensions are installed in the image but not enabled in any database. Enable them in migrations.

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

The same checks run in CI (`.github/workflows/ci.yml`) on every pull request and every push to `main`. A pull request can be merged only when CI is green.
