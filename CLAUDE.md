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
| Validation / DTOs | zod 4 schemas through Nest 12's built-in Standard Schema support (`@Body({ schema })`, global `StandardSchemaValidationPipe`); the same schemas feed OpenAPI (`@nestjs/swagger` 12) and can move to `packages/contracts` to be shared with the app |
| Auth | Own JWT: short-lived access JWT (`@nestjs/jwt`) + rotated opaque refresh tokens, argon2id passwords, `@nestjs/throttler`; provider ID tokens (Google) verified with `jose` (see [Auth](#auth), [Identity providers](#identity-providers)) |
| Mobile | Expo / React Native |
| Photo storage | Object storage (S3 compatible), GPS / EXIF stripped on upload |
| Later | Redis (realtime presence, BullMQ queues, shared rate-limit storage), Stripe |
| Repo layout | Monorepo, pnpm workspaces + Turborepo: `apps/api`, `apps/mobile`, `packages/tree-engine`, `packages/contracts` |

Rejected and why (do not reopen without a new reason):
- **MongoDB** - data is relational (social graph, feed, sessions, groups, billing), needs FK integrity and transactions; GDPR deletes are harder without FKs; JSONB covers the document-shaped parts.
- **MySQL** - weaker geo, vector, full-text and JSON support.
- **Microservices** - not for MVP; module boundaries keep the option open.
- **Separate repos for API and app** - the tree engine and API types must be shared directly; separate repos would mean publishing and version-syncing packages.
- **Laravel / Symfony** - would lose shared TypeScript (tree engine, API types) with the app.
- **class-validator / class-transformer** - decorator DTO classes cannot be shared with the app as plain schemas; zod covers validation and OpenAPI natively on Nest 12.
- **Better Auth** - session-centric and owns its tables through its own adapters, outside our TypeORM repositories, migrations and module rules; own JWT keeps auth a normal module (own `auth` schema, repositories, domain events) and fits a mobile-only client with bearer tokens.
- **Passport** - an extra layer for what a single guard and `@nestjs/jwt` already do.
- **nestjs-zod** - no Nest 12 support (peer `@nestjs/common` up to 11), and Nest 12 + `@nestjs/swagger` 12 already do what it adds.

## Architecture: modular monolith

- One deployable backend, strict boundaries between modules.
- Each module owns its tables, ideally in its own Postgres schema (`auth`, `reading`, `feed`, ...).
- **No cross-module joins** and no direct access to another module's repositories or entities. Use the other module's public service interface.
- Modules talk through **domain events** (`BookFinished`, `SessionEnded`, `InsightAdded`, ...). A new module subscribes to events; the core does not know about it.
- Depend on abstractions (interfaces / injection tokens), not concrete classes from other modules.

### Modules

MVP:
- `auth` - accounts, login (email + Google; Apple later), linking provider identities to accounts
- `identity-providers` - verifies provider ID tokens (Google now, Apple later); no tables, knows nothing about users
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

### Domain events

In process, immediately, no outbox.

- **Delivery:** `publish` runs every handler in the same process and resolves after all of them finished. An event is lost if the process crashes or a handler fails; acceptable for the MVP. Moving to an outbox / queue later must not change the publisher or handler API.
- **Publish after commit:** publish only after the write has been committed, never from inside an open transaction, so handlers never see rolled-back data.
- **Definition:** `defineDomainEvent<Payload>('BookFinished', 1)` once, in the publishing module's public API; publisher and handlers use the same definition. Names are past tense PascalCase (`BookFinished`, `SessionEnded`).
- **Versioning:** every event has a `version` (starts at 1). A breaking payload change is a new version; the old one keeps being published while consumers exist. Handlers subscribe to one version (`BookFinished.v1`), so a v2 event never reaches a v1 handler.
- **Payload:** ids and facts only, never entities or personal data beyond what the consumer needs. Events are deeply immutable copies; payloads hold only plain objects, arrays and primitives (no `Date`, `Map`, `Set`, class instances or cycles).
- **Handlers:** `@OnDomainEvent(BookFinished)` on a provider method. A failing handler is logged (event, version, handler, stack) and neither fails the publisher nor stops other handlers. Handlers must stay fast; slow work goes to a queue later. Handlers live in singleton providers; the app refuses to start otherwise.
- **Transport:** only `src/events` touches `@nestjs/event-emitter`; everyone else injects `EVENT_BUS` (ESLint enforces it).

### Module conventions

Modules live in `apps/api/src/modules/<module>/`. The reference module is `books`; copy its layout:

```
index.ts             public entry: module class, public interface (token + interface), event definitions
<module>.module.ts
book-catalogue.ts    public interface other modules inject (BOOK_CATALOGUE + BookCatalogue)
events/              domain event definitions
domain/              plain types and rules, no framework code
application/         services, repository interfaces + tokens, ProblemExceptions
http/                controllers, zod request / response schemas
persistence/         entities, *.repository.ts, entity mappers
factories/ seeds/    typeorm-extension factories and seeders
```

- **Public entry only:** other modules and code outside `modules/` (e.g. `app.module.ts`) import a module only from its `index.ts`. It never exports entities, repositories or internal services. Platform code (`src/events`, `src/http`, `src/database`, `src/shared`, `src/config`) is free to import.
- **Database access only in repositories:** services depend on a repository interface + token (`WORK_REPOSITORY`). Only `persistence/*.repository.ts` (plus the module's own `seeds/`, `factories/`) may use `@InjectRepository` / `getRepositoryToken`, `DataSource`, `EntityManager`, `QueryRunner`, `Repository`, query builders, `.query()`, `.transaction()` or `.manager` (also through subpath, dynamic or computed access; `require()` is banned in modules). A multi-table write is one transaction inside the repository; the service publishes events after it returned.
- **Schema:** entities declare `schema: '<module>'` and name their constraints (`_pkey`, `_fkey`, `_key`, `_check`, `_idx`). Unique violations become a `ProblemException` in the repository (`isUniqueViolation` from `src/database`), so concurrent duplicates answer 409, not 500.
- **HTTP:** controllers map domain types to a response DTO, never return entities. Domain errors are `ProblemException` subclasses with an own `code` in `application/`.
- **Seeds and factories:** one deterministic factory per aggregate (`setSeederFactory`, overrides via `setMeta`), registered in `apps/api/test/support/seeder-factories.ts` for the per-test `factories` fixture. Seeders are idempotent.
- **Tests** live in `apps/api/test/modules/<module>/`: behaviour through HTTP, arranged data through factories.
- **ESLint enforces** the public entry rule (`eslint-plugin-boundaries`) and repository-only database access (`no-restricted-imports` / `no-restricted-syntax`); `apps/api/test/lint/` proves both.

## The tree rule

- **Never store a picture of the tree.** Store what the reader did (sessions, marked parts, insights from friends, congratulations) and compute the tree from that data every time.
- The same reading data must always produce the same tree (deterministic, no randomness without a seed derived from the data).
- Faking reading must be burdensome: trees come from many real sessions with checkpoints, not from a single action.
- The engine is a pure function, shareable between backend (validation, anti-cheat) and the app (rendering, animation).
- **The engine is versioned.** Every tree records the `treeEngineVersion` it was computed with. Old algorithm versions stay available so finished trees never change shape. The API returns the engine version so the app knows which algorithm to render with.

## Tree engine

Package `packages/tree-engine` (`@libro/tree-engine`): zero runtime dependencies, no NestJS, no Node APIs, so the same code runs in Node and in Hermes / React Native. It exports its TypeScript source (`exports` -> `./src/index.ts`, relative imports with `.ts` extensions, `erasableSyntaxOnly`) and has no build step.

- **Consumers:** Metro, vitest and the API use the source directly. The API depends on it (`workspace:*`); `tsc` type-checks it as an external library (not emitted, no `rootDir` conflict; the API tsconfig enables `rewriteRelativeImportExtensions` so the `.ts` imports are accepted), the compiled API keeps the bare `@libro/tree-engine` import, and Node strips the types at runtime because the pnpm symlink resolves outside `node_modules` (Node never strips types inside `node_modules`). So the engine must keep erasable syntax only. Turbo's `transit` task makes the API's lint, typecheck and test caches depend on the engine's files; the dev container copies and mounts `packages/tree-engine/src`, and a production image must ship it next to the API `dist`.
- **API:** `computeTree(input, version?)` (default `LATEST_TREE_ENGINE_VERSION`), `TREE_ENGINE_VERSIONS` registry, `isTreeEngineVersion(value)` to narrow a stored version; an unknown version throws `UnknownTreeEngineVersionError`. The output carries `treeEngineVersion`.
- **Versioning:** each version lives in its own folder (`src/v1/`) with its own helpers (PRNG included) and is frozen once shipped. Any change to a version's output is a new folder (`src/v2/`) plus a registry entry; old folders are never edited. Golden snapshots (`test/__snapshots__/golden.test.ts.snap`) fail on any v1 output change; never update them for a shipped version.
- **Determinism:** the same input gives byte-identical output in every JS engine. Integer and fixed-point math only (`Math.floor`, `Math.imul`, `>>> 0`, per-mille ratios, rational saturation `x / (x + k)`); no `Math.sin` / `cos` / `exp` / `log` / `pow` / `sqrt` / `random`, no `**`, no `Date`, `Intl` or locale methods, no imports outside the package (ESLint enforces it in `packages/tree-engine/src`). Randomness is FNV-1a + MurmurHash3 finaliser over `seed/<purpose>/<ids>` feeding mulberry32. Every number in the output is an integer; the app does the trigonometry.
- **Input v1:** `{ seed (the reading id), finished, sessions: [{ activeSeconds, checkpoints: [{ page }], markedParts: [{ kind, fromPage, toPage }] }] (chronological), decorations: [{ id, kind: insight | congratulation | group_reading }] }`. Bad numbers (negative, `NaN`, infinite) count as `0`; nothing throws.
- **Counting rule:** a session counts only with at least 300 active seconds and at least 1 checkpoint; other sessions (and their marked parts) are ignored, never rejected. A session contributes at most 7200 seconds. Growth is `1000 * s / (s + 21600)` (`s` = counted seconds), so it saturates below 1000; stage `seed` (no counted session), `sapling` (< 250), `young` (< 600), `mature`.
- **Mapping:** reading time -> trunk height and thickness and branch length; each of the first 40 counted sessions -> one branch (`b<n>`, attached to the trunk or an earlier limb); good parts -> flowers; slow parts -> extra leaves; skipped parts -> thin bare twigs (`b<n>.t<k>`); finishing -> fruits. Slow and skipped parts only add, they never shrink the tree. Longer marked parts give bigger flowers, more leaves and longer twigs. Sessions after the 40th hang their leaves, flowers and twigs on branch `n % 40`.
- **Per-branch budgets:** every branch has fixed budgets, filled in session order: 6 base leaves (`b<n>.l<k>`), 6 slow-part leaves (`b<n>.s<k>`), 3 flowers, 2 twigs. Marked parts on one branch can never evict anything on another branch, and slow parts never evict base leaves. Counting looks at no more than 6 parts of each kind per session and stops allocating once a budget is full, so huge inputs stay cheap.
- **Growth continuity:** branch `n` and everything on it are derived from session `n` and the seed, so a new session keeps every earlier id, parent, position and angle; lengths, thickness and sizes only grow.
- **Fruits and decorations:** each one is placed from the seed and its own key alone (fruit index or decoration id): its position is fixed, and its branch is chosen by rendezvous hashing over the branches (the trunk while there are none). A growing tree only ever moves one onto a newly added branch; adding or removing a decoration never moves the others. Decorations sit on top and never change the shape; at most 100.
- **Output v1:** `{ treeEngineVersion: 1, stage, growth, trunk: { height, thickness }, branches: [{ id, parentId (null = trunk), position, angle, length, thickness, bare }], leaves / flowers: [{ id, branchId, position, size }], fruits: [{ id, branchId, position, size }], decorations: [{ id, kind, branchId, position }], stats: { countedSessions, ignoredSessions, countedSeconds } }`. `position` is 0 (base) to 1000 (tip) along the parent; `angle` is whole degrees from the parent direction (negative left, positive right); lengths and sizes are abstract units (trunk at most 400 high). Parents come before children. Lists are bounded (40 branches + 80 twigs, 480 leaves, 120 flowers, 8 fruits, 100 decorations).

## Auth

Own JWT, no auth framework.

- **Access token:** JWT signed with `@nestjs/jwt` (HS256, secret `JWT_ACCESS_SECRET`, at least 32 characters), lifetime 15 minutes, claims only `sub` (user id), `iss` (`libro-api`), `aud` (`libro-app`), `iat` and `exp` - no email or other personal data. Verification accepts only HS256 and checks signature, `iss`, `aud`, `exp` / `nbf`, that `sub` is a UUID, that integer `iat` and `exp` are present, `iat` is not in the future and `exp - iat` is at most 15 minutes. Production refuses to start with a blank secret or a known non-secret value (`src/config/non-secret-values.ts`: the `.env.example` and test values). Sent as `Authorization: Bearer <token>`.
- **Refresh token:** opaque random value (32 bytes), stored only as a SHA-256 hash in the `auth` schema. A token family (one sign-in) expires 30 days after sign-in, an absolute limit: rotation carries the family expiry forward and never extends it.
- **Rotation:** every refresh revokes the presented token and issues a new one in the same family, atomically - one conditional update consumes the token only while it is active, and a replacement is issued only when exactly one row was consumed. Presenting an already revoked token revokes the whole family. Logout revokes the current token.
- **Passwords:** argon2id (`@node-rs/argon2`, m=19456 KiB, t=2, p=1) behind `PASSWORD_HASHER`. 10 to 128 characters (Unicode code points, after NFKC normalisation), no other composition rules. Never logged, never returned. Emails are stored trimmed and lower case (unique `users_email_key`). An account created by a provider sign-in has no password (`password_hash` is `NULL`); an email / password login for it answers `401 invalid_credentials` after verifying against the dummy hash, exactly like a wrong password.
- **Protected by default:** a global auth guard; open endpoints opt out with `@Public()` (`/health`, register, login, refresh, logout, Google nonce and sign-in). The current user comes from a `@CurrentUser()` decorator (`AuthenticatedUser`, `{ id }`), never from the request body. Guard, decorators and the `ACCESS_TOKEN_VERIFIER` interface are platform code in `src/http/authentication/`; the auth module provides the JWT verifier, wired in `AppModule` (`AuthenticationModule.forRoot({ verifierFrom: [AuthModule] })`). The guard runs after the app version guard, so an outdated app gets `426` before `401`.
- **Errors:** no or malformed `Authorization` header -> `401 authentication_required` (`WWW-Authenticate: Bearer`); invalid, expired or foreign token -> `401 invalid_access_token` (`WWW-Authenticate: Bearer error="invalid_token"`); wrong email or password -> `401 invalid_credentials` (same body for both); taken email -> `409 email_already_registered`; unknown, used, revoked or expired refresh token -> `401 invalid_refresh_token` (one body for every case); a refresh token that is not 43 base64url characters -> `400 validation_failed`; rate limit -> `429 too_many_requests` with `Retry-After`.
- **Endpoints:** `POST /v1/auth/register` (`201`), `POST /v1/auth/login` (`200`) and `POST /v1/auth/refresh` (`200`, `{ refreshToken }`) answer `{ user: { id, email }, accessToken, tokenType: 'Bearer', expiresIn, refreshToken, refreshTokenExpiresIn }` (`refreshTokenExpiresIn` = seconds until the family expires); `POST /v1/auth/logout` (`{ refreshToken }`, `204` whether or not the token was known) revokes the family; `GET /v1/me` answers `{ id, email }`. Refresh and logout are `@Public()` and rate limited like login, so an expired access token never blocks them.
- **Storage:** `auth.sessions` is the token family (`user_id` -> `users` `ON DELETE CASCADE`, absolute `expires_at`, `revoked_at`); `auth.refresh_tokens` holds the SHA-256 hex of each token (`refresh_tokens_token_hash_key`, `session_id` -> `sessions` `ON DELETE CASCADE`, `revoked_at` when used). Rotation, reuse detection and logout are SQL in `TypeOrmSessionRepository` behind `SESSION_REPOSITORY`; each runs in one transaction that first locks the session row (`FOR UPDATE OF session`, lock order session then token) and checks expiry against `clock_timestamp()` after the lock, so a concurrent logout, reuse revocation or expiry is never missed; `SessionService` is the one place that starts, refreshes and ends sessions and logs a detected reuse with the session id only.
- **Strict reuse rule:** two concurrent refreshes with the same token give one `200`; the other one finds the token used and revokes the family, so the winner's new tokens stop refreshing too and the app signs in again. This is deliberate: a token presented twice is treated as stolen.
- **Access tokens stay stateless:** logout and family revocation do not reach access tokens already issued; they stay valid until their 15 minute expiry.
- **Follow-up:** no cleanup job removes expired or revoked sessions and used refresh tokens yet; add a periodic delete (e.g. sessions past `expires_at` or revoked for some days) before the tables grow.
- **Rate limit:** `@nestjs/throttler` on register, login, refresh, logout, Google nonce and Google sign-in: `AUTH_RATE_LIMIT_MAX` requests (default 10) per client IP and route within `AUTH_RATE_LIMIT_WINDOW_SECONDS` (default 60). Storage is in memory, fine for one instance; more instances need a shared store (Redis, later). Behind a proxy, set `TRUST_PROXY` (exact hop count, or a list of trusted IPs / CIDR ranges / `loopback`, `linklocal`, `uniquelocal`; never `true`) so the client IP comes from `X-Forwarded-For`; unset trusts no proxy and forwarded headers are ignored. Login errors do not reveal whether the email exists: an unknown email is verified against a dummy argon2 hash, so both failures take comparable time.
- **Events:** the auth module publishes `UserRegistered` v1 (`{ userId }`) after the user is committed; other modules (e.g. `profiles`) react to it and never read auth tables.
- **Google sign-in (LIB-22):** the app signs in with native Google Sign-In (the SDK handles OAuth / PKCE on the device) and sends the Google ID token; the backend verifies it and issues our own tokens. No redirect / callback flow, no client secret; Google access tokens are never accepted or stored. Configured by `GOOGLE_CLIENT_IDS` (comma-separated OAuth client IDs: iOS, Android, web; trimmed, blanks dropped); empty turns Google sign-in off and both endpoints answer `503 identity_provider_not_configured` while the app still starts.
  - **Endpoints** (`@Public()`, rate limited like login): `POST /v1/auth/google/nonce` (`201 { nonce, expiresIn }`) issues a single-use nonce for one sign-in; `POST /v1/auth/google` (`{ idToken }`, a compact JWS of at most 4096 characters, `200`) answers the same session shape as login.
  - **Nonce:** 32 random bytes base64url, stored only as SHA-256 hex in `auth.sign_in_nonces` (`nonce_hash` primary key, `provider`, `expires_at`, `created_at`; `sign_in_nonces_expires_at_idx`), valid 10 minutes from the database clock (`clock_timestamp()`). Issuing also deletes at most 100 expired rows, so the anonymous endpoint cannot grow the table forever. Sign-in verifies the token first, then consumes the nonce of its `nonce` claim with one conditional `DELETE ... RETURNING` (unexpired, same provider), so of two concurrent requests with the same token exactly one succeeds. A rejected token leaves its nonce usable.
  - **Token validation** (in `identity-providers`, see below): OpenID Connect Core 1.0 section 3.1.3.7, RFC 8725 and RFC 9700 - only `RS256`, key chosen by `kid` from the Google JWKS; `iss` exactly `accounts.google.com` or `https://accounts.google.com`; every `aud` value must be one of our client IDs; `azp`, when present, must be one of them and is required when `aud` has several values; `exp`, `iat` and `nonce` required, `iat` not in the future and `exp` / `nbf` checked with 60 seconds clock tolerance; `sub` a non-empty string.
  - **Account linking:** the identity is matched by `(provider, sub)`, never by email. A known identity signs its user in and never changes the stored email. Otherwise the provider must mark the email verified (`email_verified === true`, else `403 identity_email_not_verified`); the email is normalised like registration. If no user has that email, a new user without password is created with the identity and `UserRegistered` v1 is published after commit. An existing user with that email gets the identity linked (a password keeps working) only when the provider is authoritative for the email (`emailAuthoritative`, decided per provider in `identity-providers`; for Google, following Google's account-linking guidance: verified and either a `gmail.com` address or a Workspace account whose `hd` claim equals the email domain, case-insensitively). For any other address `email_verified` only means Google verified it at some point, so it never takes over an existing account: `409 email_account_exists` (sign in with the password), no identity is stored and no second user is created; the decision is made inside the linking transaction. An authoritative link to a user that already has a Google identity with another `sub` answers `409 identity_conflict` (never relinked silently: a Google email can be reassigned to another person). The database part is one transaction in `TypeOrmIdentityRepository` behind `IDENTITY_REPOSITORY`: a transaction-scoped advisory lock on `(provider, sub)`, a re-read of the identity, `INSERT ... ON CONFLICT DO NOTHING` for the user and the identity; so concurrent first sign-ins with the same `sub` create one user and all answer `200`, and concurrent first sign-ins of two Google accounts with the same email give one `200` and one `409 identity_conflict`. If the user row of the email disappears between the insert and the locked lookup, the insert is retried up to 3 times in the same transaction, then the answer is `409 identity_conflict`, never a `500`.
  - **Storage:** `auth.identities` (`provider`, `subject`, `user_id` -> `users` `ON DELETE CASCADE`, `created_at`; unique `identities_provider_subject_key` and `identities_user_id_provider_key`, so one identity per provider and user). Reverting the migration keeps passwordless users: each gets an argon2id hash of a discarded random secret, so nobody knows its password.
  - **Errors:** any signature, claim or nonce failure -> `401 invalid_identity_token` (only token errors: bad signature or claims, malformed token, disallowed or unsupported algorithm, no or several matching keys; one body for every case; the reason is logged at debug level, never the token); unverified email -> `403 identity_email_not_verified`; an existing account with an email the provider is not authoritative for -> `409 email_account_exists`; email account linked to another Google account -> `409 identity_conflict`; not configured -> `503 identity_provider_not_configured`; the Google keys cannot be fetched (timeout, network error, error status, invalid JSON or key set) -> `503 identity_provider_unavailable` (the app may retry with the same token and nonce; the cause is logged at warn level); malformed body -> `400 validation_failed`; rate limit -> `429 too_many_requests`.
  - **Accepted MVP risk:** email registration does not verify the email yet, so account pre-hijacking is possible (someone registers a victim's email with a password before the victim's first Google sign-in links to it). It closes when email verification / password reset by email arrives; do not work around it before then.
- **Apple (LIB-24):** same flow as Google through `identity-providers` (see below).
- **On the device:** the app keeps tokens in `expo-secure-store`.

## Identity providers

Module `identity-providers`: only verifies provider ID tokens. No tables, no users; `auth` owns accounts and linking.

- **Public interface:** `IDENTITY_TOKEN_VERIFIER` (`IdentityTokenVerifier`): `isConfigured(provider)` and `verify(provider, idToken)`, which answers a `VerifiedIdentity` (`{ provider, subject, email, emailVerified, emailAuthoritative, nonce }`, plain data) or throws `InvalidIdentityTokenException` (`401 invalid_identity_token`), `IdentityProviderNotConfiguredException` (`503 identity_provider_not_configured`) or `IdentityProviderUnavailableException` (`503 identity_provider_unavailable`); all three are exported from `index.ts`.
- **Strategy:** one generic `OidcIdTokenVerifier` over `jose` (`jwtVerify` with an `RS256` allowlist, issuers, audiences, required claims, clock tolerance, plus checks of every `aud`, `azp` and `iat`), parameterised by an `OidcProviderConfig` (`provider`, `issuers`, `clientIds`, `signingKeys`, `isEmailAuthoritative`: the provider's rule whether its verified email proves current ownership, from `email`, `email_verified` and `hd`). `IdentityTokenVerifiers` selects the verifier by provider name; a provider without client IDs counts as not configured.
- **Signing keys:** behind an injection token per provider (`GOOGLE_SIGNING_KEYS`, a `jose` `JWTVerifyGetKey`); production uses `createRemoteJWKSet` on `https://www.googleapis.com/oauth2/v3/certs`, which caches the keys and refetches on an unknown `kid`. Integration tests override the token with a local JWKS of a key pair generated in the test, so tests never call Google. Only token errors map to `401 invalid_identity_token` (an allowlist of `jose` errors); every other failure of the key source (timeout, network error, error status, invalid JSON, invalid key set or key) throws `IdentityProviderUnavailableException` (`503 identity_provider_unavailable`, exported from `index.ts`) and logs the cause at warn level without the token.
- **Adding a provider (e.g. Apple):** add the name to `IDENTITY_PROVIDERS`, a `providers/<name>.provider.ts` with its issuers, client IDs from env, its email authority rule and a `<NAME>_SIGNING_KEYS` token, list it in `oidcProviderConfigs`, extend the `provider` CHECK constraints of `auth.identities` and `auth.sign_in_nonces` in a migration, and add the two endpoints (`/v1/auth/<name>/nonce`, `/v1/auth/<name>`) next to the Google ones; `SignInNonceService` and `IdentitySignInService` already take the provider. Provider quirks (e.g. Apple hashing the nonce) belong in the provider config, not in `auth`.

## Reading sessions

Module `reading-sessions`, Postgres schema `reading`.

- **Model:** a reading is one read-through of a book (work) by a user (`reading.readings`: `user_id`, `work_id`, `started_at`, `finished_at`); at most one unfinished reading per user and work (`readings_unfinished_user_id_work_id_key`). A session belongs to a reading (`reading.sessions`, `status` `active` | `paused` | `ended`, optional `place`); checkpoints (`reading.checkpoints`, `page`) and marked parts (`reading.marked_parts`, `kind` `good` | `slow` | `skipped`, `from_page` to `to_page`) belong to a session. Sessions, checkpoints and marked parts cascade on delete. `user_id` and `work_id` are ids of other modules without FKs; the work is checked through `BOOK_CATALOGUE.workExists`.
- **One open session per user:** a partial unique index (`sessions_open_user_id_key`, `status <> 'ended'`), so a second or concurrent start answers `409`. Starting attaches the session to the unfinished reading of the book or creates one, in one transaction (upsert of the reading row, then the session insert; lock order reading then session).
- **Server time only:** every timestamp comes from the database clock in the repository SQL (`clock_timestamp()`; a start uses the transaction time `now()` so a new reading and its first session share it); client timestamps are not accepted. Active time is `active_seconds` (finished active stretches) plus the running stretch since `active_since` (set only while `active`), so pauses never count. `activeSeconds` in responses is whole seconds.
- **Transitions:** `pause` (active -> paused), `resume` (paused -> active), `end` (active or paused -> ended); of two concurrent requests only one succeeds. Checkpoints only while `active`, marked parts while `active` or `paused`.
- **Lock, then clock:** every session write is one transaction that first locks the owned session row in an allowed status (`FOR UPDATE`, so transitions, checkpoints and marked parts of one session are serialised and the per-session caps cannot be exceeded by concurrent inserts; no row -> 404 or 409) and only then writes with `clock_timestamp()`, so time is sampled after any lock wait and an end never gets an `ended_at` before a checkpoint that committed while it waited.
- **Finishing:** only when the user explicitly finishes the book. Finish locks the reading (`FOR UPDATE`), refuses while a session of it is open, then sets `finished_at`. The next session of the same book starts a new reading (re-read).
- **Input:** pages are integers 1 to 100000 (editions have no page count yet); `fromPage` must not exceed `toPage`; place is trimmed, at most 100 characters, blank becomes `null`. A session holds at most 500 checkpoints and 100 marked parts (counted by the insert itself under the session lock), so a reading's history stays bounded per session. No anti-cheat rules here, only nonsense input is rejected.
- **Endpoints** (all authenticated; another user's session or reading answers `404` exactly like an unknown id): `POST /v1/reading-sessions` (`{ workId, place? }`, `201`), `GET /v1/reading-sessions/current`, `GET /v1/reading-sessions/:sessionId`, `POST /v1/reading-sessions/:sessionId/pause`, `/resume`, `/end` (`200`) answer `{ id, readingId, workId, place, status, startedAt, endedAt, activeSeconds, checkpoints: [{ id, page, recordedAt }], markedParts: [{ id, kind, fromPage, toPage, createdAt }] }`; `POST /v1/reading-sessions/:sessionId/checkpoints` (`{ page }`, `201`, the checkpoint); `POST /v1/reading-sessions/:sessionId/marked-parts` (`{ kind, fromPage, toPage }`, `201`, the marked part); `POST /v1/readings/:readingId/finish` (`200`, `{ id, workId, startedAt, finishedAt }`).
- **Errors:** unknown book -> `404 book_not_found`; another open session -> `409 reading_session_already_open`; unknown or foreign session, or no open one for `current` -> `404 reading_session_not_found`; transition not allowed from the current status -> `409 invalid_session_transition`; checkpoint outside an active session -> `409 reading_session_not_active`; marked part in an ended session -> `409 reading_session_ended`; unknown or foreign reading -> `404 reading_not_found`; finish while a session of the reading is open -> `409 reading_session_open`; finish twice -> `409 reading_already_finished`; a checkpoint or marked part over the per-session cap -> `409 reading_session_limit_reached`; invalid input -> `400 validation_failed`.
- **Events:** `SessionEnded` v1 (`{ sessionId, readingId, userId, workId }`) and `BookFinished` v1 (`{ readingId, userId, workId }`), published after commit.
- **Public interface:** `READING_HISTORY` (`ReadingHistory`) for other modules: `findReading(userId, readingId)` (`undefined` for an unknown or foreign reading) and `listReadings(userId, { finished, limit, offset })` (finished: latest `finished_at` first; unfinished: latest `started_at` first) answer readings with only their ended sessions (`activeSeconds` in whole seconds, `checkpoints: [{ page }]`, `markedParts: [{ kind, fromPage, toPage }]`), in two queries whatever the page size. `ReadingNotFoundException` is exported too.
- **Follow-up:** anti-cheat flags for suspicious sessions (impossible pace, very short sessions, ...) belong to the tree module (LIB-29), computed from the stored data. Offline sessions with client timestamps are not supported. Reading data of a deleted account must be deleted when auth publishes an account deletion event (LIB-23).

## Tree

Module `tree`, Postgres schema `tree`. The tree rule applies: nothing about the shape is stored.

- **Storage:** only `tree.finished_trees` (`reading_id` primary key, `user_id`, `tree_engine_version` smallint `> 0`, `created_at`; `finished_trees_user_id_idx`), no FKs to other modules. Every request computes the tree with `computeTree`.
- **Input:** read through `READING_HISTORY` (public interface of `reading-sessions`), never from reading tables: `seed` = reading id, `finished` = `finishedAt` set, the ended sessions in order (`started_at`, `id`) with their checkpoints and marked parts in stored order, `decorations: []`. Open sessions never count; short or checkpoint-less sessions are passed on and the engine ignores them.
- **Versions:** a reading in progress grows with `LATEST_TREE_ENGINE_VERSION`. A `BookFinished` v1 handler records the reading with the latest version (`ON CONFLICT DO NOTHING`); a finished reading is always computed with its stored version, so it never changes shape. Events can be lost, so a finished reading without a row gets one with the latest version on its first read (same idempotent insert). A stored version the engine does not know is logged and answers `500 tree_engine_version_unavailable`; never fall back to another version.
- **Queries:** one reading or a whole page costs the same bounded number of queries: readings, their ended sessions with checkpoints and marked parts (`json_agg`), stored versions, plus an insert and a re-read when some finished readings have no row yet.
- **Endpoints** (authenticated, owner only; another user's reading answers `404 reading_not_found` exactly like an unknown id): `GET /v1/readings/:readingId/tree` answers `{ readingId, workId, finished, finishedAt, tree }` (`tree` is the engine output with its `treeEngineVersion`, schema `TreeV1`); `GET /v1/me/forest` (finished readings, latest `finishedAt` first) and `GET /v1/me/growing-trees` (unfinished readings, latest `startedAt` first) answer `{ items: [same shape], nextOffset }` with `limit` 1 to 20 (default 20; lower than book search because sessions per reading are not capped, so one tree can be large) and `offset` 0 to 1000 (default 0); `nextOffset` works as in book search.
- **Visibility:** trees and the forest are visible only to their owner for now.
- **Follow-up:** decorations from insights, congratulations and group reading; sharing trees with profiles (LIB-26); deleting a user's `tree.finished_trees` rows on account deletion (LIB-23); caching computed trees only if computing ever gets expensive.

## Book search

Module `books`, `GET /v1/books?q=&limit=&offset=` (authenticated).

- **Normalising:** `books.search_normalise(text)` (`lower(unaccent(...))`, declared `IMMUTABLE` because `unaccent()` itself is only `STABLE` and cannot be indexed) normalises both the stored text and the query, always in SQL, so "stastie" finds "šťastie" and "kafka" finds "Kafka".
- **Matching:** the normalised query is split on whitespace into at most 5 distinct tokens; a work matches when every token is a substring (`LIKE`, wildcards `%`, `_`, `\` escaped) of its title, an edition title or an author name. A query that is an ISBN-13 or a valid ISBN-10 (hyphens and spaces ignored) also matches the edition with that `isbn13`.
- **Ranking:** best `word_similarity` of the whole query against the title, edition titles and author names first, then title, then id, so pages are stable.
- **Indexes:** GIN trigram expression indexes (`gin_trgm_ops`) on `books.search_normalise(...)` of `works.title`, `editions.title` and `authors.name` (`*_search_idx`), created in a migration. TypeORM does not load expression indexes, so they stay out of entity metadata and `db:migration:check`.
- **Input and answer:** `q` trimmed, 2 to 100 characters; `limit` 1 to 50 (default 20); `offset` 0 to 1000 (default 0). Answers `200` `{ items: [{ id, title, authors: [{ id, name }] }], nextOffset }`; `nextOffset` is `null` on the last page or when it would pass the offset limit.

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
   - `X-Platform` is `ios` or `android`, `X-App-Version` is `MAJOR.MINOR.PATCH`; minimums come from `MIN_APP_VERSION_IOS` / `MIN_APP_VERSION_ANDROID` (default `0.0.0`).
   - Neither header: the request passes (health checks, curl, web). Both valid and below the minimum: `426` with code `app_update_required`. Only one header, unknown platform or malformed version: `400` with code `invalid_app_client`.
   - Every request with app headers that reaches a route logs one `client platform=... version=... outcome=...` line, so usage of old versions can be counted. Requests without them are not logged.
4. **Expo OTA (EAS Update)** for JS-only changes; native changes still need a store release and must match `runtimeVersion`.
5. **Deprecation:** keep an old API version for 3-6 months, track usage by `X-App-Version`, remove it only when unused or below the minimum supported version.
6. The app must tolerate unknown fields and unknown enum values (ignore or show a fallback, never crash).
7. **Contract tests** assert that `v1` response shapes stay unchanged.

## API input and errors

- **Every input has a zod schema:** body, query and params are declared with `@Body({ schema })`, `@Query({ schema })`, `@Param({ schema })`. A parameter without a schema is not validated.
- **Unknown request fields are stripped,** not rejected (`z.object`). Use `z.strictObject` only where rejecting is a deliberate part of the contract.
- **Every error is RFC 9457 Problem Details** (`application/problem+json`: `type`, `title`, `status`, `detail`, `instance`, `code`, plus `errors[]` with `path`, `message`, `code` for validation). Only the global `ProblemDetailsFilter` writes error responses. Clients branch on `code`, never on `detail`. The one exception is `/health`, which answers `503` with its own health report (same shape as its `200`).
- Throw `ProblemException` with an own `code` for domain errors; plain Nest `HttpException`s get a code derived from the status (`not_found`, `conflict`, ...). 5xx never expose internal messages; they are logged server-side.
- The error shape is part of the `v1` contract: changing it needs a new version.

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

- Production hosting provider (EU region required).
