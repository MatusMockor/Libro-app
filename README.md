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

| What                 | Default                           | Variable         |
| -------------------- | --------------------------------- | ---------------- |
| api health check     | `http://127.0.0.1:3000/health`    | `API_PORT`       |
| OpenAPI (Swagger UI) | `http://127.0.0.1:3000/docs`      | `API_PORT`       |
| OpenAPI (JSON)       | `http://127.0.0.1:3000/docs-json` | `API_PORT`       |
| Node inspector       | `127.0.0.1:9229`                  | `API_DEBUG_PORT` |
| Postgres             | `127.0.0.1:5433`                  | `DB_PORT`        |

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
| Entities   | `**/*.entity.ts`            | `modules/books/persistence/work.entity.ts`              |
| Migrations | `**/migrations/*.ts`        | `database/migrations/1793115072337-EnableExtensions.ts` |
| Seeders    | `**/seeds/*.seeder.ts`      | `modules/books/seeds/books.seeder.ts`                   |
| Factories  | `**/factories/*.factory.ts` | `modules/books/factories/work.factory.ts`               |

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

1. Every entity of the module declares it: `@Entity({ schema: 'books', name: 'works' })`.
2. The module's first migration creates the schema before its tables: `await queryRunner.createSchema('books', true);`. TypeORM does not generate this line, add it by hand after `db:migration:generate`.
3. Its `down()` drops the schema after dropping the tables: `await queryRunner.dropSchema('books');`.

Foreign keys, unique constraints and `ON DELETE` rules stay inside a module schema. No foreign key points into another module's schema.

### Seeders and factories

Seeders and factories use [`typeorm-extension`](https://github.com/tada5hi/typeorm-extension). A seeder is a default-exported class implementing `Seeder` in a `seeds/*.seeder.ts` file; a factory is a default-exported `setSeederFactory(...)` in a `factories/*.factory.ts` file. Seeders are idempotent, so running `pnpm db:seed` again changes nothing.

`pnpm db:seed` fills the `books` catalogue with a handful of works: Slovak classics (Hviezdoslav, Timrava, Urban, Figuli) and translated books with an English or French original and a Slovak edition (Le Petit Prince, Nineteen Eighty-Four, Good Omens with two authors). Their ISBN-13s are synthetic test data from the `979-0` range (ISMN, printed music), which never belongs to a real book; a book is skipped when one of its ISBN-13s is already stored.

## API

The api code that is not a domain module lives in `apps/api/src/http/` (validation, error format, authentication guard, OpenAPI), `apps/api/src/health/` and `apps/api/src/events/` (domain events). They are wired in `AppModule` and `configureApp`, so tests and `main.ts` get exactly the same behaviour.

### Versioning

URI versioning: every route is served under `/v1/...` unless its controller says otherwise (`defaultVersion: '1'`). A route without the prefix (`/books`) or with an unknown version (`/v2/books`) is a 404. Only infrastructure endpoints such as `/health` are `VERSION_NEUTRAL`. See [CLAUDE.md](CLAUDE.md#api-versioning) for what counts as a breaking change.

### Validation and DTOs

Input is validated with [zod](https://zod.dev) schemas through Nest 12's built-in Standard Schema support: the schema goes into the parameter decorator, the global `StandardSchemaValidationPipe` validates (and transforms, e.g. `z.coerce.number()` for query strings) the value before the handler runs, and `@nestjs/swagger` turns the same schema into OpenAPI. There is no DTO class; the DTO type is inferred from the schema.

```ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';

export const createBookSchema = z
  .object({
    title: z.string().min(1),
    pages: z.number().int().positive(),
  })
  .meta({ id: 'CreateBook' });

export type CreateBookDto = z.infer<typeof createBookSchema>;

const listBooksQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(50) });
const bookParamsSchema = z.object({ id: z.uuid() });

@Controller('books')
export class BooksController {
  @Post()
  create(@Body({ schema: createBookSchema }) book: CreateBookDto) {}

  @Get()
  list(@Query({ schema: listBooksQuerySchema }) query: z.infer<typeof listBooksQuerySchema>) {}

  @Get(':id')
  find(@Param({ schema: bookParamsSchema }) params: z.infer<typeof bookParamsSchema>) {}
}
```

- A parameter without a `schema` is passed through unvalidated, so every body, query and params object declares one.
- `.meta({ id })` names the schema in the OpenAPI components (`#/components/schemas/CreateBook`); without it the schema is inlined.
- **Unknown fields are stripped**, not rejected: `z.object` drops keys the schema does not declare, so the handler never sees them (no mass assignment) and a client sending an extra field still works. Use `z.strictObject` only where rejecting unknown fields is a deliberate part of the contract.

### Error format

Every error response, from validation, unknown routes, malformed JSON, thrown `HttpException`s and unexpected errors, is [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457) with `Content-Type: application/problem+json`, written by the global `ProblemDetailsFilter`:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "The request contains invalid fields.",
  "instance": "/v1/books",
  "code": "validation_failed",
  "errors": [
    { "path": "pages", "message": "Too small: expected number to be >0", "code": "too_small" }
  ]
}
```

| Field      | Meaning                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`     | Always `about:blank` for now, so `title` is the HTTP status phrase                                                                                                                          |
| `title`    | HTTP status phrase (`Not Found`, `Conflict`, ...)                                                                                                                                           |
| `status`   | HTTP status code                                                                                                                                                                            |
| `detail`   | Human-readable explanation, for logs and developers; do not parse it                                                                                                                        |
| `instance` | Request path, without the query string                                                                                                                                                      |
| `code`     | Stable machine-readable code, the field clients branch on                                                                                                                                   |
| `errors`   | Only for `validation_failed`: one entry per invalid field, `path` is dot-separated (`tags.1`), `code` is the zod issue code (`invalid_type`, `too_small`, `too_big`, `invalid_format`, ...) |

Codes:

- `validation_failed` (400) - a body, query or params schema rejected the input.
- A code derived from the status phrase for any Nest `HttpException`: `bad_request` (also malformed JSON), `not_found` (also unknown routes), `conflict`, `payload_too_large`, ...
- An own code for domain errors: `throw new ProblemException({ status: 409, code: 'book_already_finished', detail: '...' })`.
- `app_update_required` (426) and `invalid_app_client` (400) from the app version check (see below).
- `authentication_required` and `invalid_access_token` (401) from the authentication guard, `invalid_credentials` (401), `email_already_registered` (409) and `too_many_requests` (429) from the auth module (see [Authentication](#authentication)).
- `internal_server_error` (500) for anything that is not an `HttpException`.
- Module codes, for example `isbn_already_exists` (409) and `book_not_found` (404) from the books catalogue (see below).

A `ProblemException` can also carry response headers (`headers` in its init, e.g. `WWW-Authenticate`); the filter sends them with the problem body.

5xx responses never expose internal messages or stack traces: an unexpected error answers `detail: "An unexpected error occurred."`, a 5xx `HttpException` answers its status phrase. The original error is logged server-side with Nest's `Logger`. Only `ProblemException` can send a deliberate 5xx `detail`.

The shape is part of the `v1` contract and covered by `apps/api/test/api-contract.e2e.test.ts`.

### App version check

The app sends `X-Platform` (`ios` / `android`, case-insensitive) and `X-App-Version` (`MAJOR.MINOR.PATCH`) on every request. A global guard (`apps/api/src/http/app-version/`) compares the version numerically per component (`1.10.0` is newer than `1.9.0`) with the minimum of its platform from `MIN_APP_VERSION_IOS` / `MIN_APP_VERSION_ANDROID` (default `0.0.0`, nobody is blocked). It runs on every route, `/health` included; `/docs` is not a Nest route and is not checked.

| Request                                                | Answer                                |
| ------------------------------------------------------ | ------------------------------------- |
| Neither header (health checks, curl, web)              | passes                                |
| Both headers, version at or above the platform minimum | passes                                |
| Both headers, version below the platform minimum       | `426` with code `app_update_required` |
| Only one header, unknown platform or malformed version | `400` with code `invalid_app_client`  |

Every request with app headers that reaches a Nest route logs one line under the `AppVersion` context, for example `client platform=ios version=1.4.0 outcome=accepted` (`outcome` is `accepted`, `outdated` or `invalid`; invalid headers log `platform=unknown version=unknown`). Requests without the headers (health checks) are not logged, and no other header is logged.

### OpenAPI

The Swagger UI is served at `/docs` and the OpenAPI 3.0 document at `/docs-json` (and `/docs-yaml`). They are enabled whenever `NODE_ENV` is not `production`, so in local development and tests, and never in production. The document is built on the first request from the controllers and their zod schemas; it includes every route, the `ProblemDetails` schema as the `default` and `426` response of every operation, the optional `X-App-Version` / `X-Platform` headers on every operation, and `/health`. It declares the `bearer` security scheme (HTTP bearer, JWT) as a document-wide requirement, so every operation needs the access token; `@Public()` operations override it with an empty requirement (`security: [{}]`, no token needed). In the Swagger UI, use "Authorize" with the `accessToken` from register or login.

### Health

`GET /health` (version neutral) pings the database with `SELECT 1`:

| State         | Status | Body                                                      |
| ------------- | ------ | --------------------------------------------------------- |
| database up   | `200`  | `{ "status": "ok", "checks": { "database": "up" } }`      |
| database down | `503`  | `{ "status": "error", "checks": { "database": "down" } }` |

The body keeps the same `application/json` shape for both answers so monitoring can read `checks` (it is a probe report, not an error, so it is the one non-2xx answer that is not Problem Details). The Docker Compose healthcheck of the api only looks at the status code. New checks (e.g. Redis) are added as `HealthIndicator`s under the `HEALTH_INDICATORS` token and appear as new keys in `checks`, which is backward compatible.

### Domain events

Modules talk through domain events instead of calling each other. `EventsModule` (`apps/api/src/events/`) is global, so any module injects the bus without importing it. The transport is [`@nestjs/event-emitter`](https://github.com/nestjs/event-emitter), hidden behind `EVENT_BUS`; ESLint rejects imports of `@nestjs/event-emitter` / `eventemitter2` outside `src/events/`.

```ts
export interface BookFinishedPayload {
  readonly bookId: string;
  readonly readerId: string;
}

export const BookFinished = defineDomainEvent<BookFinishedPayload>('BookFinished', 1);
export type BookFinished = DomainEventOf<typeof BookFinished>;

@Injectable()
export class ReadingService {
  constructor(@Inject(EVENT_BUS) private readonly events: EventBus) {}

  async finish(bookId: string, readerId: string): Promise<void> {
    await this.events.publish(BookFinished.create({ bookId, readerId }));
  }
}

@Injectable()
export class ShelfHandler {
  @OnDomainEvent(BookFinished)
  async onBookFinished(event: BookFinished): Promise<void> {}
}
```

- An event is a deeply frozen `{ name, version, occurredAt, payload }`; `create(payload, occurredAt?)` copies both (the payload in one pass that accepts only plain objects, arrays and primitives with enumerable data fields, and freezes the copy) and stamps `occurredAt` with the current time unless given.
- Handlers subscribe to `<name>.v<version>` (`BookFinished.v1`), so a `BookFinished` v2 never reaches a v1 handler.
- `publish` resolves after every handler finished. A handler that throws or rejects is logged under the `DomainEvents` context (`Handler ShelfHandler.onBookFinished failed for BookFinished v1: ...` plus the stack); the publisher and the other handlers are not affected.
- Handlers live in singleton (default scope) providers. A request or transient scoped provider with an `@OnDomainEvent` method, also one that is request scoped through a dependency, stops the app at startup.
- Delivery is in process and immediate, without an outbox: publish only after the transaction has committed. See [CLAUDE.md](CLAUDE.md#domain-events) for the rules.

### Modules

Domain modules live in `apps/api/src/modules/<module>/`, each with its own Postgres schema, and talk to each other only through their public entry (`index.ts`) and domain events. ESLint fails when a module (or `app.module.ts`) imports another module's internal files, or when code outside a repository class (`*.repository.ts`) touches the database. See [CLAUDE.md](CLAUDE.md#module-conventions) for the layout and rules; `books` is the reference module.

### Books catalogue

The `books` module (schema `books`) stores works (`works`), their authors in credit order (`authors`, `work_authors`) and editions (`editions`, with an optional unique ISBN-13 and an ISO 639-1 language).

| Route                   | Answer                                                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/books`        | Adds a work with its authors (ordered names, one new author row per name for now) and at least one edition. `201` with the book, `409 isbn_already_exists` for a duplicate ISBN-13 |
| `GET /v1/books/:workId` | `200` with the work, its authors in credit order and its editions (by publication year), `404 book_not_found`                                                                      |

ISBN-13s are 13 digits without hyphens and must have a valid check digit. A duplicate is detected by the unique constraint, so two concurrent requests with the same ISBN-13 answer `201` and `409`. The work, its authors and editions are written in one transaction; after it committed, the module publishes `BookAddedToCatalogue` v1 (`{ workId, editionIds }`). Other modules check a work through `BOOK_CATALOGUE` (`workExists(workId)`), exported from `modules/books/index.ts` with the event. Both routes need an access token (protected by default, see [Authentication](#authentication)).

### Authentication

Own JWT access tokens, no auth framework (see [CLAUDE.md](CLAUDE.md#auth) for the design). The `auth` module (schema `auth`, table `users`) owns accounts; refresh tokens and logout come with the next part of LIB-20.

| Route                    | Access | Answer                                                                                                                                |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/auth/register` | public | `{ email, password }`. `201` with a session, `409 email_already_registered`, `400 validation_failed`, `429 too_many_requests`         |
| `POST /v1/auth/login`    | public | `{ email, password }`. `200` with a session, `401 invalid_credentials` (same answer for an unknown email and a wrong password), `429` |
| `GET /v1/me`             | token  | `200` with `{ id, email }` of the signed-in user                                                                                      |

A session is `{ "user": { "id": "...", "email": "..." }, "accessToken": "...", "tokenType": "Bearer", "expiresIn": 900 }`. Emails are compared case-insensitively and without surrounding spaces (stored trimmed and lower case). Passwords need 10 to 128 characters (Unicode code points after NFKC normalisation) and no other rules; they are hashed with argon2id and never logged or returned. After a registration is stored, the module publishes `UserRegistered` v1 (`{ userId }`).

**Protected by default.** A global guard (`apps/api/src/http/authentication/`) runs after the app version check on every route and needs `Authorization: Bearer <accessToken>`:

| Request                                                                 | Answer                                                                       |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Route marked `@Public()`                                                | passes, the `Authorization` header is ignored                                |
| No `Authorization` header, another scheme or a malformed value          | `401 authentication_required`, `WWW-Authenticate: Bearer`                    |
| Token with a wrong signature or algorithm, expired, other `iss` / `aud` | `401 invalid_access_token`, `WWW-Authenticate: Bearer error="invalid_token"` |
| Valid token                                                             | passes, the handler gets the user through `@CurrentUser()`                   |

```ts
import { Controller, Get } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../http/authentication/authenticated-user.js';
import { CurrentUser } from '../../../http/authentication/current-user.decorator.js';
import { Public } from '../../../http/authentication/public.decorator.js';

@Controller('shelf')
export class ShelfController {
  @Get()
  mine(@CurrentUser() user: AuthenticatedUser) {}

  @Get('featured')
  @Public()
  featured() {}
}
```

The access token is a JWT (HS256, signed with `JWT_ACCESS_SECRET`) valid for 15 minutes with only the claims `sub` (user id), `iss` (`libro-api`), `aud` (`libro-app`), `iat` and `exp`. A token without integer `iat` and `exp`, with `iat` in the future or with a lifetime over 15 minutes is rejected as well. The api refuses to start with a blank `JWT_ACCESS_SECRET`, and in production with one of the known non-secret values from `apps/api/src/config/non-secret-values.ts` (the `.env.example` and test values). The guard does not read the database; `GET /v1/me` answers `401 invalid_access_token` when the account of a valid token no longer exists.

**Rate limit.** Register and login accept at most `AUTH_RATE_LIMIT_MAX` requests (default 10) per client IP and route within `AUTH_RATE_LIMIT_WINDOW_SECONDS` (default 60), invalid ones included. Above it they answer `429 too_many_requests` with `Retry-After` (seconds). The counters live in memory, per api process. The client IP is the address of the connection; behind a load balancer or reverse proxy set `TRUST_PROXY` so it comes from `X-Forwarded-For` instead, either as the exact number of proxies (`TRUST_PROXY=1`) or as a list of trusted proxy addresses (`TRUST_PROXY=loopback, 10.0.0.0/8`, IPs, CIDR ranges and the named ranges `loopback`, `linklocal`, `uniquelocal`). It is applied in `configureApp` as Express `trust proxy`; unrestricted trust (`true`) is refused at startup, because then any client could pick its own IP by sending the header.

Calling protected endpoints locally (`pnpm dev`, api on `127.0.0.1:3000`):

```sh
curl -s -X POST http://127.0.0.1:3000/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"reader@example.test","password":"a quiet afternoon"}'

TOKEN=$(curl -s -X POST http://127.0.0.1:3000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"reader@example.test","password":"a quiet afternoon"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')

curl -s http://127.0.0.1:3000/v1/me -H "Authorization: Bearer $TOKEN"
```

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

Turborepo caches `test` like `lint` and `typecheck`: the tests are hermetic, so a run is replayed from the cache while nothing they depend on changed (the package files, the lockfile, `tsconfig.base.json`, `eslint.config.js`, `docker/postgres/**` and `.env.test`). Use `pnpm test --force` to run them anyway. `DOCKER_*` and `TESTCONTAINERS_*` variables are passed through to the tests, so a non-default Docker socket (`DOCKER_HOST`) works.

The same checks run in CI (`.github/workflows/ci.yml`) on every pull request and every push to `main`. After the tests, CI starts the compose Postgres (`pnpm db:up`) and runs `pnpm db:migrate`, `pnpm db:migration:check` (fails when an entity changed without a migration) and `pnpm db:seed` against it. A pull request can be merged only when CI is green.

## Testing

Integration tests run against a real Postgres that [Testcontainers](https://node.testcontainers.org/) starts for every `pnpm test` run. The only requirement is a running Docker daemon.

How the harness in `apps/api/test/support/` works:

1. **Once per run** (`global-setup.ts`, Vitest `globalSetup`): builds `docker/postgres/Dockerfile`, the same image Docker Compose uses, as `libro-app-postgres:test` (BuildKit, so it is a cache hit after the first build), starts it with the data directory in `tmpfs`, creates the database `libro_template` and runs all migrations on it.
2. **Once per test file** (`database-per-file.setup.ts`, Vitest `setupFiles`): clones `libro_template` into a new database `test_<random>`, points `DATABASE_URL` at it before the file is imported, and drops it after the file. Test files never share a database, so they run in parallel.
3. **Once per test** (`integration-test.ts`): truncates every table in every non-system schema (with `RESTART IDENTITY CASCADE`), except the migration bookkeeping (`public.migrations`, `public.typeorm_metadata`) and tables owned by extensions (PostGIS `spatial_ref_sys`). Rows inserted by a data migration are truncated too, so a test that needs them inserts them itself.

Writing an integration test: import `test` from `./support/integration-test.js` instead of `vitest` and take what you need from its fixtures.

| Fixture      | What it is                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| `app`        | The full Nest app (`AppModule` + `configureApp`), booted once per file                                       |
| `http`       | A supertest client bound to `app`                                                                            |
| `dataSource` | The TypeORM `DataSource` of `app`, for arranging data and asserting on the database                          |
| `factories`  | A `typeorm-extension` `SeederFactoryManager` on `dataSource` with every module factory, fresh for every test |
| `signIn`     | `signIn(meta?)` stores a factory user and returns `{ id, email, authorization }` with a real access token    |

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

A file that needs routes the app does not have (for example to exercise validation or error mapping before a real endpoint exists) builds its own `test` with extra modules. The test-only modules live in `apps/api/test/support/` (see `probe/`), never in `src`; they still go through the real `configureApp`, pipe, filter and versioning:

```ts
import { integrationTest } from './support/integration-test.js';
import { ProbeModule } from './support/probe/probe.module.js';

const test = integrationTest({ imports: [ProbeModule] });
```

`test.beforeAll(async ({ dataSource }) => ...)` can use the file fixtures, for example to create a test-only table. Rows inserted there are gone before the first test, because every test starts from empty tables: arrange data inside the test.

Tests that need no app (for example `config.test.ts`) use plain `vitest`; they still get their own database, which costs a few milliseconds. `migrations.test.ts` reverts and re-applies every migration through the CLI data source on its own per-file database, so it cannot affect other files.

Arrange data through the module factories (registered in `apps/api/test/support/seeder-factories.ts`). A factory builds a deterministic, valid aggregate (every test starts from the same default values); `setMeta` overrides parts of it:

```ts
const work = await factories
  .get<WorkEntity, WorkFactoryMeta>(WorkEntity)
  .setMeta({ title: 'Good Omens', authors: ['Terry Pratchett', 'Neil Gaiman'] })
  .save();
```

Routes are protected by default, so a test calls them with a signed-in user. The token comes from the app's own issuer, so tests never build JWTs by hand (except deliberately forged ones in the guard tests). Factory users share one argon2 hash computed once per test process, and their password is `FACTORY_USER_PASSWORD` from `modules/auth/factories/user.factory.ts`:

```ts
test('answers 200', async ({ http, signIn }) => {
  const { authorization } = await signIn();

  const response = await http.get('/v1/me').set('Authorization', authorization);

  expect(response.status).toBe(200);
});
```

Test probe controllers in `test/support/` are `@Public()`, except `ProbeProtectedController` (`GET /v1/probe/protected`, answers the `@CurrentUser()`). `apps/api/vitest.config.ts` sets a test-only `JWT_ACCESS_SECRET` and raises `AUTH_RATE_LIMIT_MAX` to 1000, so no test file hits the rate limit by accident; `test/modules/auth/rate-limit.e2e.test.ts` lowers it with `vi.stubEnv` before importing the harness and resets the counters before every test.

Module tests live in `apps/api/test/modules/<module>/`. `apps/api/test/lint/` lints virtual files with the real ESLint config to prove the module boundary and database access rules.

A first run on a machine without the image downloads `postgis/postgis` and builds the image; later runs reuse the cached layers.
