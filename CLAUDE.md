# Libro app - agent & developer rules

Single source of truth for how this project is built. Applies to humans and AI agents alike.
If a decision here needs to change, change it here first, then in code.

## Product in one paragraph

"read more" is a calm, book-only social app for readers, starting from the Libro Club community (180+ readers in Slovakia). Users post to a shared feed, run timed reading sessions (others can see and join them), mark good / slow / skipped parts, and every finished book grows a **tree** shaped by how it was read. Finished trees form a forest on the profile. Slovak first, English and Ukrainian later.

It is NOT a dating app (people meet in groups of 3+, around books, in public places) and NOT an attention trap (no streak guilt, no ads based on reading data). Reading data stays private.

## Current scope

- Mobile app: Expo / React Native.
- Current focus: **backend MVP**, built as a modular monolith so new modules (Stripe, matching, ...) can be added without touching the core.

## Stack

| Piece | Choice |
|---|---|
| Backend framework | NestJS (TypeScript) |
| ORM | TypeORM 1.x (`typeorm@^1.1` + `@nestjs/typeorm@^12`, confirmed compatible), repository mode (`TypeOrmModule.forFeature` + `@InjectRepository`) |
| Database | PostgreSQL (with PostGIS, pgvector, `unaccent`, `pg_trgm` when needed) |
| Mobile | Expo / React Native |
| Photo storage | Object storage (S3 compatible), GPS / EXIF stripped on upload |
| Later | Redis (realtime presence, BullMQ queues), Stripe |
| Repo layout | Monorepo, pnpm workspaces + Turborepo: `apps/api`, `apps/mobile`, `packages/tree-engine`, `packages/contracts` |

Rejected and why (do not reopen without a new reason):
- **MongoDB** - data is relational (social graph, feed, sessions, groups, billing), needs FK integrity and transactions; GDPR deletes are harder without FKs; JSONB covers the document-shaped parts.
- **MySQL** - weaker geo, vector, full-text and JSON support.
- **Microservices** - not for MVP; module boundaries keep the option open.
- **Separate repos for API and app** - the tree engine and API types must be shared directly; separate repos would mean publishing and version-syncing packages.
- **Laravel / Symfony** - would lose shared TypeScript (tree engine, API types) with the app.

## Architecture: modular monolith

- One deployable backend, strict boundaries between modules.
- Each module owns its tables, ideally in its own Postgres schema (`auth`, `reading`, `feed`, ...).
- **No cross-module joins** and no direct access to another module's repositories or entities. Use the other module's public service interface.
- Modules talk through **domain events** (`BookFinished`, `SessionEnded`, `InsightAdded`, ...). A new module subscribes to events; the core does not know about it.
- Depend on abstractions (interfaces / injection tokens), not concrete classes from other modules.

### Modules

MVP:
- `auth` - accounts, login (Apple / Google + email)
- `profiles` - photo, bio, favourite genres, top 3 books
- `books` - catalogue (e.g. Open Library import)
- `reading-sessions` - timer, checkpoints, marked parts (good / slow / skipped), joining sessions
- `tree` - deterministic tree engine
- `feed` - posts, likes, emoji comments, places
- `media` - uploads, EXIF / GPS stripping

Later (design so they plug in via events and interfaces):
- `billing` - Stripe webhooks + entitlements
- `matching` - groups of 3+ based on read / liked books, never 1:1
- `realtime` - live sessions (WebSocket gateway)
- `search`, `ai`, `notifications`

## The tree rule

- **Never store a picture of the tree.** Store what the reader did (sessions, marked parts, insights from friends, congratulations) and compute the tree from that data every time.
- The same reading data must always produce the same tree (deterministic, no randomness without a seed derived from the data).
- Faking reading must be burdensome: trees come from many real sessions with checkpoints, not from a single action.
- The engine is a pure function, shareable between backend (validation, anti-cheat) and the app (rendering, animation).
- **The engine is versioned.** Every tree records the `treeEngineVersion` it was computed with. Old algorithm versions stay available so finished trees never change shape. The API returns the engine version so the app knows which algorithm to render with.

## Database rules

- PostgreSQL only. Schema per module: entities declare `schema: '<module>'`, the module's first migration creates the schema (`queryRunner.createSchema('<module>', true)`) and its `down()` drops it (`queryRunner.dropSchema('<module>')`).
- Schema changes go **only through migrations** (TypeORM CLI, `up()` + `down()`). Data migrations live in `up()` too. Migrations live in a `migrations/` folder (`pnpm db:migration:generate <Name>` writes to `apps/api/src/database/migrations/`).
- `synchronize` is always `false`, in every environment, including local. CI fails when an entity changes without a migration (`pnpm db:migration:check`).
- Extensions are enabled only in migrations, in the `public` schema. TypeORM's `installExtensions` stays off.
- Use foreign keys, unique constraints and `ON DELETE` rules inside a module so integrity (and GDPR deletion) is enforced by the database, not by hope.
- Use JSONB for genuinely flexible data, not as a way to skip modelling.
- Seeders / factories via `typeorm-extension`.
- Host in the EU (e.g. Neon or Supabase, Frankfurt). Locally and in tests: Docker `postgis/postgis`.

## API versioning

Mobile users do not update immediately, so old app versions must keep working.

1. **Backward-compatible changes by default.** Adding fields, optional params and new endpoints needs no new version. Removing / renaming a field, changing its type or meaning, or adding a required param is breaking and needs a new version.
2. **URI versioning from day one:** `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`, routes under `/v1/...`. Version only the endpoints that changed (`@Version('2')` or a `V2` controller).
3. **Minimum supported app version.** The app sends `X-App-Version` and `X-Platform` on every request. The backend keeps a per-platform minimum and answers older clients with `426 Upgrade Required`; the app then shows a forced-update screen.
4. **Expo OTA (EAS Update)** for JS-only changes; native changes still need a store release and must match `runtimeVersion`.
5. **Deprecation:** keep an old API version for 3-6 months, track usage by `X-App-Version`, remove it only when unused or below the minimum supported version.
6. The app must tolerate unknown fields and unknown enum values (ignore or show a fallback, never crash).
7. **Contract tests** assert that `v1` response shapes stay unchanged.

## Testing

- Feature / integration tests through real collaborators against a **real PostgreSQL** (Testcontainers). Do not mock internal repositories, services or helpers.
- Integration tests use the harness in `apps/api/test/support/` (`test` from `integration-test.ts`): one Testcontainers Postgres per run, a database per test file cloned from the migrated template, tables truncated before every test. Tests and test files must not depend on each other or on their order.
- Mock / stub only true external boundaries (Stripe, object storage, third-party HTTP APIs). Never make real network calls to third parties in tests.
- Never `throw` in test code; use the framework's assertions so a failed precondition reads as an assertion failure.
- Verify changes with **lint, typecheck (`tsc --noEmit`) and tests**. Do not run a production build just to check that code compiles.

## Code style

- SOLID throughout; depend on abstractions so units are testable and swappable.
- Use design patterns where they genuinely fit (Strategy, Repository, Factory, Adapter, Command, Observer, Pipeline, ...). Do not force them.
- Guard clauses / early return. No `else` / `else if`.
- Small, focused classes and functions.
- No code comments unless explicitly requested. Only tooling-required annotations are allowed, without prose.
- In prose (docs, PR / commit messages) use a plain hyphen `-`, never long dashes.

## Git

- Default branch `main`; work on feature branches.
- Branch name: use the branch name Linear generates for the issue (`<user>/lib-<n>-<slug>`, "Copy git branch name" in the issue). The `lib-<n>` part links the PR to the issue.
- PR title starts with the issue ID(s): `LIB-15: TypeORM setup and migrations`.
- PR description lists each issue it finishes as `Closes LIB-<n>` (one line per issue). Use `Part of LIB-<n>` when the PR does not finish the issue - it links without moving it to Done.
- Do not move Linear issue status by hand once a PR exists. Linear git automations do it: draft / open -> In Progress, review request / ready to merge -> In Review, merge -> Done.
- One PR per issue by default; combine issues only when they cannot be tested separately.
- No AI attribution in commits or PR descriptions (no `Co-Authored-By`, no "Generated with ..." footers).

## Open decisions

- Auth provider: Better Auth vs. own JWT (+ Apple / Google sign-in).
- Production hosting provider (EU region required).
