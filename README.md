# TinyLink

A production-grade URL shortener: create short links, redirect at scale, and capture privacy-aware
click analytics.

## Repository layout

| Path | Description |
| --- | --- |
| [`server/`](./server) | NestJS API — shortening, redirects, auth, analytics, background jobs |
| [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) | Production-readiness review and remediation notes |

## Features

- Short-link creation with pluggable code strategies (`random`, `hash`, `hashids`, `auto-increment`, `snowflake`)
- Fast redirects backed by Redis caching
- Click analytics with hashed IPs and optional GeoIP, ingested asynchronously via BullMQ
- JWT auth (access/refresh), Argon2 password hashing, email OTP verification, session management
- QR code generation for short links
- First-class observability: `/metrics` (Prometheus), OpenTelemetry tracing, structured logs, split health probes

## Quick start

```bash
cd server
pnpm install
docker compose up -d          # local Postgres + Redis (dev only)
cp .env.example .env          # fill in secrets
pnpm prisma migrate deploy
pnpm prisma:generate
pnpm start:dev
```

The API listens on `http://localhost:3000`. Interactive docs are at `/docs`.

See the [server runbook](./server/README.md) for configuration, testing, deployment, and operations.

## Tech stack

NestJS 11 · TypeScript · Prisma 7 · PostgreSQL · Redis · BullMQ · Pino · Prometheus · OpenTelemetry

## License

Released under the [MIT License](./LICENSE).
