# TinyLink Server

Production URL shortener API built with [NestJS](https://nestjs.com/), Prisma, PostgreSQL, Redis and BullMQ.

This document is the operational runbook. For a high-level project overview see the [root README](../README.md).

## Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Testing](#testing)
- [Database & migrations](#database--migrations)
- [Building & running in production](#building--running-in-production)
- [Deployment (Docker Compose on a VM)](#deployment-docker-compose-on-a-vm)
- [Service roles & scaling](#service-roles--scaling)
- [Observability](#observability)
- [API documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

## Architecture

| Concern | Technology |
| --- | --- |
| HTTP framework | NestJS 11 (Express) |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| Cache & rate limiting | Redis (ioredis) |
| Background jobs | BullMQ (analytics ingestion, session/analytics cleanup) |
| Auth | JWT access/refresh, Argon2 password hashing, OTP email verification |
| Short codes | Pluggable strategies: `random`, `hash`, `hashids`, `auto-increment`, `snowflake` |
| Logging | Pino (structured JSON) |
| Metrics | Prometheus (`prom-client`) at `/metrics` |
| Tracing | OpenTelemetry (OTLP), enabled when `OTEL_EXPORTER_OTLP_ENDPOINT` is set |

The application is a single image that can run as a **web** server, a **worker**, or **both** (see [Service roles](#service-roles--scaling)).

## Prerequisites

- Node.js `>=24 <25` (see `engines` in `package.json`)
- pnpm (via Corepack: `corepack enable`)
- Docker + Docker Compose (for local datastores and deployment)

## Local development

```bash
# 1. Install dependencies
pnpm install

# 2. Start local Postgres + Redis (development only)
docker compose up -d

# 3. Create your env file and fill in secrets
cp .env.example .env

# 4. Apply migrations and generate the Prisma client
pnpm prisma migrate deploy
pnpm prisma:generate

# 5. Run in watch mode
pnpm start:dev
```

> `docker-compose.yml` is **local development only**. Use `docker-compose.prod.yml` for deployment.

## Configuration

All configuration is via environment variables, validated at startup by the Zod schema in
`src/config/env.schema.ts`. If validation fails the process exits — fail fast.

Copy `.env.example` and fill in every value. Key variables:

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `development` \| `test` \| `production` |
| `PORT` | no | Defaults to `3000` |
| `BASE_URL` | yes | Public origin; also used to build the HTTPS-redirect host |
| `SERVICE_ROLE` | no | `web` \| `worker` \| `all` (default `all`) |
| `TRUST_PROXY` | no | Trusted reverse-proxy hop count for `req.ip` (default `1`). MUST match the real number of proxies so IP-based rate limits can't be spoofed via `X-Forwarded-For`; use `0` when exposed directly |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `REDIS_URL` | yes | Redis connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | yes | Min 32 chars, distinct values |
| `SHORT_CODE_STRATEGY` | no | Defaults to `random` |
| `SHORT_CODE_SNOWFLAKE_WORKER_ID` | conditionally | **Required and unique per replica** when strategy is `snowflake` |
| `SHORT_CODE_HASHIDS_SALT` | conditionally | Required when strategy is `hashids` |
| `IP_HASH_SALT` | yes | Salt for hashing analytics IPs |
| `MAILER_*` | yes | SMTP host/port/user/pass/from |
| `LOG_LEVEL` | no | `info` by default |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | no | Enables tracing when set |

## Testing

```bash
# Unit tests (no database required)
pnpm test

# Integration tests (requires the test Postgres)
cp .env.test.example .env.test   # .env.test is NOT committed
pnpm test:db:up
pnpm prisma migrate deploy
pnpm test:integration

# e2e tests
pnpm test:e2e

# Everything
pnpm test:all

# Coverage
pnpm test:cov

# Stop the test database
pnpm test:db:down
```

Static checks: `pnpm typecheck` (strict) and `pnpm lint:check`.

## Database & migrations

Migrations are managed by Prisma and live in `prisma/migrations`.

- Create a migration: `pnpm prisma migrate dev --name <change>`
- Apply in CI/production: `pnpm prisma migrate deploy`

In production, migrations run as a **one-shot `migrate` service** (see the migrator image) and
**not** on application startup, so app containers stay stateless and roll out safely.

## Building & running in production

```bash
pnpm build            # compiles to dist/
node dist/main.js     # or: pnpm start:prod
```

The container entrypoint (`docker-entrypoint.sh`) simply launches the app; it does not run migrations.

## Deployment (Docker Compose on a VM)

Deployment targets a VM running Docker Compose, driven by `.github/workflows/cd.yml`:

1. CD builds and pushes two images tagged with the commit SHA: the slim **app** image and a **migrator** image.
2. Images are scanned (Trivy) and signed (Cosign) before deploy.
3. Over SSH, the VM pulls the immutable SHA-tagged images, writes `.env`, then runs:
   - the one-shot `migrate` service (must exit 0),
   - `docker compose -f docker-compose.prod.yml up -d` for `app` (and `worker`),
   - a health-check gate on `/health/ready`, with rollback to the previous SHA on failure.

Required deploy-time variables (`IMAGE`, `MIGRATE_IMAGE`, datastore credentials) are documented at
the bottom of `.env.example`.

## Service roles & scaling

`SERVICE_ROLE` selects what a process runs:

- `web` — serves HTTP only (background workers/schedulers are disabled).
- `worker` — runs BullMQ workers and cron schedulers only.
- `all` — both (fine for a single-node / dev setup).

For horizontal scaling run separate `web` and `worker` services. If using the `snowflake`
short-code strategy, **each replica must have a unique `SHORT_CODE_SNOWFLAKE_WORKER_ID`** or IDs
will collide (the app fails fast if it is missing).

## Observability

- **Health**: `/health/live` (process liveness), `/health/ready` (DB + Redis readiness), `/health` (full check).
- **Metrics**: Prometheus exposition at `/metrics` — HTTP request duration/count, cache hit/miss, BullMQ queue depth, and Node default metrics.
- **Tracing**: set `OTEL_EXPORTER_OTLP_ENDPOINT` to export OpenTelemetry traces (auto-instrumentation for HTTP, Postgres, Redis, etc.).
- **Logs**: structured JSON via Pino; level controlled by `LOG_LEVEL`.

### Prometheus (local)

The app only *exposes* metrics; run a Prometheus server to scrape them. The dev
`docker compose up -d` now includes a `prometheus` service (config in `prometheus.yml`):

```bash
docker compose up -d prometheus     # or `docker compose up -d` for the whole stack
pnpm start:dev                      # the app must be running to be scraped
```

- Prometheus UI: `http://localhost:9090` (try queries like `http_requests_total` or
  `rate(http_request_duration_seconds_count[5m])`).
- Confirm the target is healthy at `http://localhost:9090/targets` (job `tinylink`).
- It scrapes `host.docker.internal:3000` because the app runs on the host. If you instead run
  the app as its own Compose service, point the target at that service name (e.g. `app:3000`)
  in `prometheus.yml`.
- `/metrics` is unauthenticated — in production keep it on the private network (the prod
  compose binds the app to `127.0.0.1` behind a reverse proxy) and do not expose it publicly.

## Short-code strategies

`SHORT_CODE_STRATEGY` selects how short codes are generated. Choose based on your throughput,
guessability, and coordination requirements.

| Strategy | Codes | Collisions | Enumerable? | Needs coordination | Best for |
| --- | --- | --- | --- | --- | --- |
| `random` | Random base62, fixed length | Possible (retry on conflict) | No | None | Default; unguessable links |
| `hash` | Hash of the URL | Same URL → same code | Somewhat | None | De-duplicating identical URLs |
| `hashids` | Encoded incremental id | None | Yes (obfuscated) | Shared counter | Short codes with no DB lookup collisions |
| `auto-increment` | Base62 of incremental id | None | **Yes (sequential)** | Shared counter | Internal/low-abuse use only |
| `snowflake` | Base62 of a Snowflake id | None (per worker) | Partially | **Unique worker id per replica** | High write throughput, horizontal scale |

Trade-offs:

- **Guessability**: `auto-increment` produces sequential, trivially enumerable codes — avoid for
  public links. `random`/`snowflake` are far harder to guess.
- **Coordination**: `hashids` and `auto-increment` depend on a shared counter (a DB sequence); this
  is a serialization point under very high write rates. `snowflake` avoids the shared counter but
  **requires a unique `SHORT_CODE_SNOWFLAKE_WORKER_ID` per replica** — duplicate worker ids cause
  colliding codes. The app fails fast if the worker id is missing under this strategy.
- **Collisions**: `random` can collide and relies on retry-on-conflict; the id-based strategies do
  not collide by construction (given correct configuration).

## Data lifecycle: retention, partitioning & rollup

The high-volume, append-only tables (`Analytics`, `AuditLog`) are managed to keep them bounded and
fast:

- **Retention jobs** (BullMQ repeatable, run on `worker`/`all` roles):
  - Analytics: `AnalyticsCleanupService` deletes rows older than the configured retention window.
  - Audit: `AuditRetentionWorker` deletes `AuditLog` rows older than
    `AUDIT_CONSTANTS.DEFAULT_RETENTION_DAYS` (180 days) on a daily cron.
- **Time-series BRIN indexes** (`Analytics_timestamp_brin_idx`, `AuditLog_createdAt_brin_idx`) make
  range scans and the retention `DELETE`s efficient as the tables grow.

### Graduating to native partitioning (high volume)

When a single table becomes too large for retention deletes to keep up, convert to PostgreSQL
declarative **range partitioning** by month. Prisma cannot express partitioning, so apply it as a
raw-SQL migration during a maintenance window. Outline:

```sql
-- 1. Recreate as a partitioned parent (requires data migration of existing rows).
CREATE TABLE "Analytics_p" (LIKE "Analytics" INCLUDING ALL) PARTITION BY RANGE ("timestamp");
-- 2. Create monthly partitions (automate with pg_partman or a monthly cron).
CREATE TABLE "Analytics_y2026m07" PARTITION OF "Analytics_p"
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
-- 3. Backfill, swap names, drop the old table.
```

With partitioning, retention becomes an instant `DROP TABLE <old_partition>` instead of a large
`DELETE`.

### Rollups

For long-term dashboards, pre-aggregate clicks into a daily rollup rather than scanning raw rows.
Recommended: a materialized view (or summary table populated by a nightly job) keyed by
`(urlId, day)` with click counts and top dimensions, refreshed after the retention job. Raw rows can
then be retained for a shorter window than the aggregates.

## API documentation

Interactive Swagger UI is served at `/docs` (OpenAPI JSON at `/docs-json`) in non-production environments.

For a hands-on, endpoint-by-endpoint walkthrough (curl examples covering the full auth, URL,
QR, analytics, and session flows), see the [API testing guide](./API_TESTING.md).

## Troubleshooting

- **Startup exits immediately**: env validation failed — check the logged Zod error and `.env`.
- **`/health/ready` returns 503**: Postgres or Redis is unreachable.
- **Duplicate short codes under load with `snowflake`**: replicas share a worker id — assign unique `SHORT_CODE_SNOWFLAKE_WORKER_ID` per instance.
- **SMTP errors on boot**: port `465` requires `MAILER_SECURE=true`; verify credentials and TLS settings.
