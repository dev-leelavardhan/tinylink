# 05 — Caching & Redirect Optimization: Production Implementation Guide

**Project:** TinyLink URL Shortener (NestJS + Prisma + PostgreSQL + Redis)
**Goal:** Make redirects fast by serving them from Redis (cache-aside), and keep the cache correct on updates/deletes.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Install Dependencies](#3-install-dependencies)
4. [Redis Module & Service](#4-redis-module--service)
5. [Environment Configuration](#5-environment-configuration)
6. [Cache Key Schema](#6-cache-key-schema)
7. [Cache Service (Cache-Aside Logic)](#7-cache-service-cache-aside-logic)
8. [Wire Cache into UrlsService](#8-wire-cache-into-urlsservice)
9. [Cache Invalidation on Mutations](#9-cache-invalidation-on-mutations)
10. [Negative Caching](#10-negative-caching)
11. [Health Check Integration](#11-health-check-integration)
12. [Unit & Integration Tests](#12-unit--integration-tests)
13. [Metrics / Observability](#13-metrics--observability)
14. [Redis Memory & TTL Tuning](#14-redis-memory--ttl-tuning)
15. [Production Deployment Checklist](#15-production-deployment-checklist)
16. [ADR: Why Redis + Cache-Aside](#16-adr-why-redis--cache-aside)
17. [Interview Notes](#17-interview-notes)

---

## 1. Architecture Overview

```
Client
  │
  ▼
GET /:code
  │
  ▼
RedirectController
  │
  ▼
UrlsService.redirect(code)
  │
  ├──► Redis GET url:<code>
  │       │
  │       ├── HIT  → return cached object → 302 redirect (no DB)
  │       │
  │       └── MISS → Prisma DB query
  │                   │
  │                   ├── found → Redis SET url:<code> (TTL) → 302 redirect
  │                   │
  │                   └── not found → optionally cache negative marker → 404
  │
  ▼
302 Found → Location: <originalUrl>
```

**Why cache-aside (lazy loading)?**
- Simple to implement and reason about.
- Resilient — if Redis dies, the app still works (just slower, hitting DB).
- Fits the read-heavy redirect path (~100:1 reads:writes).
- No complex write-path coupling.

---

## 2. Prerequisites

- Redis instance running (local or hosted — Upstash free tier works).
- `REDIS_URL` already in your `.env.example` and `env.schema.ts` (confirmed: both exist).
- NestJS project with Prisma wired and healthy.

---

## 3. Install Dependencies

```bash
pnpm add ioredis
pnpm add -D @types/ioredis
```

`ioredis` is the production-grade Redis client for Node.js. It supports clustering, sentinels, pipelines, Lua scripting, and automatic reconnection.

---

## 4. Redis Module & Service

### 4.1 Create `src/redis/redis.service.ts`

```typescript
import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService
  extends Redis
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly appConfig: ConfigService) {
    super(appConfig.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
      enableReadyCheck: true,
      lazyConnect: true,
      keepAlive: 30000,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
      this.logger.log('Redis connected');
    } catch (err) {
      this.logger.error('Redis connection failed', err);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
  }
}
```

### 4.2 Create `src/redis/redis.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

### 4.3 Register in `src/app.module.ts`

```typescript
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ /* ... */ }),
    LoggerModule.forRoot(pinoConfig),
    PrismaModule,
    RedisModule, // <-- add here (global, so all modules can inject)
    HealthModule,
    UrlsModule,
  ],
  // ...
})
export class AppModule {}
```

---

## 5. Environment Configuration

Your `env.schema.ts` already has `REDIS_URL: z.url()`. No changes needed.

Ensure your `.env` and `.env.example` both have:

```
REDIS_URL=redis://<user>:<password>@<host>:6379
```

For local development:

```
REDIS_URL=redis://localhost:6379
```

---

## 6. Cache Key Schema

```
Key:    url:<shortCode>
Value:  JSON string of the cached URL object
TTL:    Configurable (default 3600s = 1 hour)
```

### Cached Object Shape

```typescript
interface CachedUrl {
  id: string;
  originalUrl: string;
  shortCode: string;
  customAlias: string | null;
  disabled: boolean;
  expiresAt: string | null; // ISO 8601 string
  lastAccessedAt: string | null;
}
```

**Why cache all these fields?** The `redirect()` method branches on `disabled`, `expiresAt`, and `originalUrl`. If you only cache `originalUrl`, you can't evaluate disabled/expired without a DB fallback, defeating the purpose.

### Key Naming

| Scenario | Key | Example |
|---|---|---|
| Primary short code lookup | `url:<shortCode>` | `url:aB3xYz7` |
| Custom alias lookup | `url:<customAlias>` | `url:my-link` |

Both `shortCode` and `customAlias` are unique, so the same key namespace works. The `redirect()` method already queries by both fields — we cache the result under whichever was used for the lookup.

### Constants

Create `src/redis/cache.constants.ts`:

```typescript
export const CACHE_CONSTANTS = {
  /** TTL in seconds — 1 hour default, configurable via env */
  DEFAULT_TTL_SECONDS: 3600,

  /** TTL for negative cache (not-found) — 60 seconds */
  NEGATIVE_TTL_SECONDS: 60,

  /** Cache key prefix */
  KEY_PREFIX: 'url:',

  /** Redis command count estimate for free-tier budgeting */
  ESTIMATED_COMMANDS_PER_REDIRECT: 1, // GET on hit; GET + SET on miss
} as const;
```

---

## 7. Cache Service (Cache-Aside Logic)

Create `src/urls/cache/url-cache.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { CACHE_CONSTANTS } from '../../redis/cache.constants';

/** The subset of Url fields needed to evaluate a redirect decision */
export interface CachedUrl {
  id: string;
  originalUrl: string;
  shortCode: string;
  customAlias: string | null;
  disabled: boolean;
  expiresAt: string | null;
  lastAccessedAt: string | null;
}

/** Sentinel stored for negative cache (not-found) */
const NEGATIVE_SENTINEL = 'NOT_FOUND';

@Injectable()
export class UrlCacheService {
  private readonly logger = new Logger(UrlCacheService.name);
  private readonly ttl: number;
  private readonly negativeTtl: number;

  constructor(private readonly redis: RedisService) {
    // In production, inject these from ConfigService
    this.ttl = CACHE_CONSTANTS.DEFAULT_TTL_SECONDS;
    this.negativeTtl = CACHE_CONSTANTS.NEGATIVE_TTL_SECONDS;
  }

  private key(shortCode: string): string {
    return `${CACHE_CONSTANTS.KEY_PREFIX}${shortCode}`;
  }

  /**
   * Cache-aside GET: returns CachedUrl on hit, null on miss.
   * On negative cache hit, returns a special marker so caller can short-circuit.
   */
  async get(shortCode: string): Promise<CachedUrl | null> {
    try {
      const raw = await this.redis.get(this.key(shortCode));

      if (raw === null) {
        // Cache miss
        this.logger.debug({ shortCode }, 'Cache miss');
        return null;
      }

      if (raw === NEGATIVE_SENTINEL) {
        // Negative cache hit — caller should treat as "not found"
        this.logger.debug({ shortCode }, 'Cache hit (negative/not-found)');
        return null; // Caller distinguishes via logic; see note below
      }

      // Positive cache hit
      this.logger.debug({ shortCode }, 'Cache hit');
      return JSON.parse(raw) as CachedUrl;
    } catch (err) {
      this.logger.warn({ shortCode, err }, 'Cache GET failed, falling back to DB');
      return null;
    }
  }

  /**
   * Store a resolved URL in cache.
   */
  async set(shortCode: string, data: CachedUrl): Promise<void> {
    try {
      await this.redis.setex(
        this.key(shortCode),
        this.ttl,
        JSON.stringify(data),
      );
      this.logger.debug({ shortCode }, 'Cache SET');
    } catch (err) {
      this.logger.warn({ shortCode, err }, 'Cache SET failed');
      // Non-fatal — the redirect still works from DB
    }
  }

  /**
   * Cache a negative (not-found) result to blunt lookups for garbage codes.
   * Short TTL so a later-created code isn't shadowed.
   */
  async setNegative(shortCode: string): Promise<void> {
    try {
      await this.redis.setex(
        this.key(shortCode),
        this.negativeTtl,
        NEGATIVE_SENTINEL,
      );
      this.logger.debug({ shortCode }, 'Cache SET (negative)');
    } catch (err) {
      this.logger.warn({ shortCode, err }, 'Cache SET negative failed');
    }
  }

  /**
   * Invalidate a cached entry (on update/delete/disable).
   */
  async invalidate(shortCode: string): Promise<void> {
    try {
      await this.redis.del(this.key(shortCode));
      this.logger.debug({ shortCode }, 'Cache DEL');
    } catch (err) {
      this.logger.warn({ shortCode, err }, 'Cache DEL failed');
    }
  }

  /**
   * Invalidate both shortCode and customAlias keys if they differ.
   */
  async invalidateAll(shortCode: string, customAlias: string | null): Promise<void> {
    await this.invalidate(shortCode);
    if (customAlias && customAlias !== shortCode) {
      await this.invalidate(customAlias);
    }
  }
}
```

**Key design decisions:**
- `get()` returns `null` on miss — standard cache-aside pattern.
- `setNegative()` prevents repeated DB hits for nonexistent codes.
- All cache failures are non-fatal (logged, but redirect still works via DB).
- `invalidateAll()` handles both shortCode and customAlias cache keys.

---

## 8. Wire Cache into UrlsService

Modify `src/urls/service/urls.service.ts`:

### 8.1 Add Dependency

```typescript
import { UrlCacheService, CachedUrl } from '../cache/url-cache.service';

@Injectable()
export class UrlsService {
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly shortCodeGenerator: ShortCodeGeneratorService,
    private readonly aliasValidator: AliasValidatorService,
    private readonly cache: UrlCacheService, // <-- NEW
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UrlsService.name);
    this.baseUrl = this.config.getOrThrow<string>('BASE_URL');
  }
```

### 8.2 Rewrite `redirect()` with Cache-Aside

Replace the existing `redirect()` method:

```typescript
async redirect(shortCode: string): Promise<string> {
  this.logger.debug({ shortCode }, URL_REDIRECT_LOG_MESSAGES.RESOLVING_URL);

  try {
    // ── Step 1: Try cache ──
    const cached = await this.cache.get(shortCode);

    if (cached) {
      // ── Cache HIT: evaluate business logic on cached data ──
      if (cached.disabled) {
        this.logger.warn(
          { id: cached.id, shortCode },
          URL_REDIRECT_ERROR_MESSAGES.URL_DISABLED,
        );
        throw new GoneException(URL_REDIRECT_ERROR_MESSAGES.URL_DISABLED);
      }

      if (cached.expiresAt && new Date(cached.expiresAt) <= new Date()) {
        this.logger.warn(
          { id: cached.id, shortCode, expiresAt: cached.expiresAt },
          URL_REDIRECT_ERROR_MESSAGES.URL_EXPIRED,
        );
        throw new GoneException(URL_REDIRECT_ERROR_MESSAGES.URL_EXPIRED);
      }

      this.logger.info(
        { id: cached.id, shortCode, source: 'cache' },
        URL_REDIRECT_LOG_MESSAGES.REDIRECT_SUCCESS,
      );

      return cached.originalUrl;
    }

    // ── Step 2: Cache MISS → query DB ──
    this.logger.debug({ shortCode }, 'Cache miss, querying DB');

    const url = await this.prisma.url.findFirst({
      where: {
        OR: [{ shortCode }, { customAlias: shortCode }],
      },
    });

    if (!url) {
      this.logger.warn(
        { shortCode },
        URL_REDIRECT_ERROR_MESSAGES.URL_NOT_FOUND,
      );

      // Negative cache: prevent repeated DB hits for garbage codes
      await this.cache.setNegative(shortCode);

      throw new NotFoundException(URL_REDIRECT_ERROR_MESSAGES.URL_NOT_FOUND);
    }

    if (url.disabled) {
      this.logger.warn(
        { id: url.id, shortCode },
        URL_REDIRECT_ERROR_MESSAGES.URL_DISABLED,
      );
      throw new GoneException(URL_REDIRECT_ERROR_MESSAGES.URL_DISABLED);
    }

    if (url.expiresAt && url.expiresAt <= new Date()) {
      this.logger.warn(
        { id: url.id, shortCode, expiresAt: url.expiresAt },
        URL_REDIRECT_ERROR_MESSAGES.URL_EXPIRED,
      );
      throw new GoneException(URL_REDIRECT_ERROR_MESSAGES.URL_EXPIRED);
    }

    // ── Step 3: Populate cache ──
    const cachedUrl: CachedUrl = {
      id: url.id,
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      customAlias: url.customAlias,
      disabled: url.disabled,
      expiresAt: url.expiresAt?.toISOString() ?? null,
      lastAccessedAt: url.lastAccessedAt?.toISOString() ?? null,
    };

    await this.cache.set(shortCode, cachedUrl);

    // Also cache under customAlias if it exists and differs
    if (url.customAlias && url.customAlias !== shortCode) {
      await this.cache.set(url.customAlias, cachedUrl);
    }

    this.logger.info(
      {
        id: url.id,
        shortCode,
        source: 'db',
      },
      URL_REDIRECT_LOG_MESSAGES.REDIRECT_SUCCESS,
    );

    return url.originalUrl;
  } catch (error: unknown) {
    if (
      error instanceof NotFoundException ||
      error instanceof GoneException
    ) {
      throw error;
    }

    this.logger.error(
      { err: error, shortCode },
      URL_REDIRECT_ERROR_MESSAGES.RESOLVE_FAILED,
    );

    throw new InternalServerErrorException();
  }
}
```

### 8.3 Register UrlCacheService in UrlsModule

Update `src/urls/urls.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { RedirectController, UrlsController } from './urls.controller';
import { UrlsService } from './service/urls.service';
import { ShortCodeModule } from '../common/short-code/short-code.module';
import { AliasValidatorService } from './service/alias-validator.service';
import { UrlCacheService } from './cache/url-cache.service';

@Module({
  imports: [ShortCodeModule],
  controllers: [UrlsController, RedirectController],
  providers: [UrlsService, AliasValidatorService, UrlCacheService],
})
export class UrlsModule {}
```

---

## 9. Cache Invalidation on Mutations

Every write operation that changes URL state must invalidate the cache. In your current codebase, `create()` is the only mutation. But as you add `PATCH`/`DELETE`/`disable` in later phases, each must call `cache.invalidateAll()`.

### 9.1 Invalidate on Create

At the end of `create()`, after a URL is successfully created or reused, there's nothing to invalidate (it's new). But if we want the redirect cache to be fresh for any concurrent lookup, we can proactively populate:

```typescript
// At the end of create(), after the prisma.url.create call:
const cachedUrl: CachedUrl = {
  id: url.id,
  originalUrl: url.originalUrl,
  shortCode: url.shortCode,
  customAlias: url.customAlias,
  disabled: url.disabled,
  expiresAt: url.expiresAt?.toISOString() ?? null,
  lastAccessedAt: url.lastAccessedAt?.toISOString() ?? null,
};

await this.cache.set(shortCode, cachedUrl);
```

### 9.2 Invalidate on Future Mutations (Phase 04+)

When you implement `PATCH` (update) and `DELETE` / `disable` endpoints, add cache invalidation:

```typescript
// Example for a future update() method:
async update(shortCode: string, dto: UpdateUrlDto): Promise<Url> {
  const existing = await this.prisma.url.findFirst({
    where: { OR: [{ shortCode }, { customAlias: shortCode }] },
  });

  if (!existing) {
    throw new NotFoundException('URL not found');
  }

  const updated = await this.prisma.url.update({
    where: { id: existing.id },
    data: {
      originalUrl: dto.originalUrl ?? existing.originalUrl,
      disabled: dto.disabled ?? existing.disabled,
      expiresAt: dto.expiresAt ?? existing.expiresAt,
    },
  });

  // INVALIDATE CACHE — must happen after DB write
  await this.cache.invalidateAll(existing.shortCode, existing.customAlias);

  // Optionally re-populate with fresh data
  const cachedUrl: CachedUrl = {
    id: updated.id,
    originalUrl: updated.originalUrl,
    shortCode: updated.shortCode,
    customAlias: updated.customAlias,
    disabled: updated.disabled,
    expiresAt: updated.expiresAt?.toISOString() ?? null,
    lastAccessedAt: updated.lastAccessedAt?.toISOString() ?? null,
  };
  await this.cache.set(updated.shortCode, cachedUrl);

  return updated;
}

// Example for a future disable() method:
async disable(shortCode: string): Promise<void> {
  const url = await this.prisma.url.findFirst({
    where: { OR: [{ shortCode }, { customAlias: shortCode }] },
  });

  if (!url) {
    throw new NotFoundException('URL not found');
  }

  await this.prisma.url.update({
    where: { id: url.id },
    data: { disabled: true },
  });

  // INVALIDATE CACHE — next redirect will hit DB and see disabled=true
  await this.cache.invalidateAll(url.shortCode, url.customAlias);
}
```

### 9.3 The Invalidation Rule

```
Every PATCH / DELETE / disable endpoint MUST call:
  await this.cache.invalidateAll(url.shortCode, url.customAlias);
AFTER the DB write succeeds.
```

**Do not skip this.** A stale cache serving a deleted/disabled URL is a real bug — users would be redirected to URLs that no longer exist or should be blocked.

---

## 10. Negative Caching

### Why Negative Cache?

When a user visits `/not-a-real-code`, without negative caching:
1. Redis GET → miss
2. Prisma query → not found
3. Return 404

Next visit to `/not-a-real-code`:
1. Redis GET → miss
2. Prisma query → not found
3. Return 404

Attackers or bots hitting garbage codes generate unnecessary DB load. Negative caching short-circuits this:

1. Redis GET → miss
2. Prisma query → not found
3. Redis SET `NOT_FOUND` with 60s TTL
4. Return 404

Next visit within 60s:
1. Redis GET → hit (`NOT_FOUND` sentinel)
2. Return 404 (no DB hit)

### Tradeoff

- **Pros:** Reduces DB load from garbage/attack traffic.
- **Cons:** If a code is created within 60s of a negative cache entry, the negative cache shadows it. The 60s TTL bounds this window.
- **Mitigation:** When creating a URL, explicitly `DEL` the key before caching the positive entry:

```typescript
// In create(), before populating cache:
await this.redis.del(this.key(shortCode)); // Clear any negative cache
await this.cache.set(shortCode, cachedUrl);
```

This is already handled by the `set()` method in `UrlCacheService` — Redis `SETEX` overwrites any existing value (including negative sentinels).

---

## 11. Health Check Integration

Update `src/health/health.service.ts` to include Redis:

```typescript
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check() {
    const result: Record<string, string> = {};

    // Check PostgreSQL
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      result.db = 'up';
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        db: 'down',
        redis: result.redis ?? 'unknown',
      });
    }

    // Check Redis
    try {
      const pong = await this.redis.ping();
      result.redis = pong === 'PONG' ? 'up' : 'degraded';
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        db: result.db,
        redis: 'down',
      });
    }

    return {
      status: 'ok',
      ...result,
    };
  }
}
```

Update `src/health/health.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
```

Note: `PrismaService` and `RedisService` are both `@Global()` modules, so they're automatically available for injection.

---

## 12. Unit & Integration Tests

### 12.1 Unit Test: UrlCacheService

Create `src/urls/cache/url-cache.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UrlCacheService } from './url-cache.service';
import { RedisService } from '../../redis/redis.service';

describe('UrlCacheService', () => {
  let service: UrlCacheService;
  let redis: Record<string, string | null>;

  beforeEach(async () => {
    redis = {};

    const mockRedis = {
      get: jest.fn((key: string) => Promise.resolve(redis[key] ?? null)),
      setex: jest.fn((key: string, _ttl: number, value: string) => {
        redis[key] = value;
        return Promise.resolve('OK');
      }),
      del: jest.fn((key: string) => {
        delete redis[key];
        return Promise.resolve(1);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlCacheService,
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<UrlCacheService>(UrlCacheService);
  });

  describe('get', () => {
    it('returns null on cache miss', async () => {
      const result = await service.get('abc123');
      expect(result).toBeNull();
    });

    it('returns CachedUrl on positive hit', async () => {
      const data = {
        id: '1',
        originalUrl: 'https://example.com',
        shortCode: 'abc123',
        customAlias: null,
        disabled: false,
        expiresAt: null,
        lastAccessedAt: null,
      };
      redis['url:abc123'] = JSON.stringify(data);

      const result = await service.get('abc123');
      expect(result).toEqual(data);
    });

    it('returns null on negative cache hit', async () => {
      redis['url:abc123'] = 'NOT_FOUND';

      const result = await service.get('abc123');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('stores JSON with TTL', async () => {
      const data = {
        id: '1',
        originalUrl: 'https://example.com',
        shortCode: 'abc123',
        customAlias: null,
        disabled: false,
        expiresAt: null,
        lastAccessedAt: null,
      };

      await service.set('abc123', data);
      expect(redis['url:abc123']).toBe(JSON.stringify(data));
    });
  });

  describe('invalidate', () => {
    it('deletes the cache key', async () => {
      redis['url:abc123'] = '{"some":"data"}';
      await service.invalidate('abc123');
      expect(redis['url:abc123']).toBeUndefined();
    });
  });

  describe('invalidateAll', () => {
    it('deletes both shortCode and alias keys', async () => {
      redis['url:abc123'] = '{"some":"data"}';
      redis['url:my-link'] = '{"some":"data"}';

      await service.invalidateAll('abc123', 'my-link');
      expect(redis['url:abc123']).toBeUndefined();
      expect(redis['url:my-link']).toBeUndefined();
    });
  });
});
```

### 12.2 Unit Test: UrlsService.redirect() with Cache

Update `src/urls/tests/urls.service.spec.ts` to mock the cache:

```typescript
// Add to existing UrlsService test setup:

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  setNegative: jest.fn(),
  invalidate: jest.fn(),
  invalidateAll: jest.fn(),
};

// In Test.createTestingModule providers:
{
  provide: UrlCacheService,
  useValue: mockCacheService,
},

// Test cases:

describe('redirect', () => {
  it('returns URL from cache on hit (no DB call)', async () => {
    mockCacheService.get.mockResolvedValue({
      id: '1',
      originalUrl: 'https://example.com',
      shortCode: 'abc123',
      customAlias: null,
      disabled: false,
      expiresAt: null,
      lastAccessedAt: null,
    });

    const result = await service.redirect('abc123');

    expect(result).toBe('https://example.com');
    expect(mockCacheService.get).toHaveBeenCalledWith('abc123');
    // Prisma should NOT be called
    expect(mockPrisma.url.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to DB on cache miss and populates cache', async () => {
    mockCacheService.get.mockResolvedValue(null);
    mockPrisma.url.findFirst.mockResolvedValue({
      id: '1',
      originalUrl: 'https://example.com',
      shortCode: 'abc123',
      customAlias: null,
      disabled: false,
      expiresAt: null,
      lastAccessedAt: null,
    });

    const result = await service.redirect('abc123');

    expect(result).toBe('https://example.com');
    expect(mockCacheService.set).toHaveBeenCalledWith(
      'abc123',
      expect.objectContaining({ originalUrl: 'https://example.com' }),
    );
  });

  it('returns 404 and caches negative on not found', async () => {
    mockCacheService.get.mockResolvedValue(null);
    mockPrisma.url.findFirst.mockResolvedValue(null);

    await expect(service.redirect('nope')).rejects.toThrow(NotFoundException);
    expect(mockCacheService.setNegative).toHaveBeenCalledWith('nope');
  });

  it('throws GoneException for disabled URL from cache', async () => {
    mockCacheService.get.mockResolvedValue({
      id: '1',
      originalUrl: 'https://example.com',
      shortCode: 'abc123',
      customAlias: null,
      disabled: true,
      expiresAt: null,
      lastAccessedAt: null,
    });

    await expect(service.redirect('abc123')).rejects.toThrow(GoneException);
  });
});
```

### 12.3 Integration Test

Create `test/url-cache.integration-spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Redirect with Redis Cache (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('first redirect hits DB, second redirect hits cache', async () => {
    // Create a URL
    const createRes = await request(app.getHttpServer())
      .post('/urls')
      .send({ originalUrl: 'https://example.com' })
      .expect(201);

    const { shortCode } = createRes.body;

    // First redirect — should work (cache miss, DB hit)
    await request(app.getHttpServer())
      .get(`/${shortCode}`)
      .expect(302)
      .expect('Location', 'https://example.com');

    // Second redirect — should also work (cache hit, no DB)
    await request(app.getHttpServer())
      .get(`/${shortCode}`)
      .expect(302)
      .expect('Location', 'https://example.com');
  }, 15000);

  it('returns 404 and caches negative for nonexistent code', async () => {
    await request(app.getHttpServer())
      .get('/nonexistent123')
      .expect(404);
  });
});
```

---

## 13. Metrics / Observability

### 13.1 Add Hit/Miss Counters to UrlCacheService

Add simple counters that feed into your observability stack:

```typescript
// In UrlCacheService constructor:
private hits = 0;
private misses = 0;

// In get():
if (raw && raw !== NEGATIVE_SENTINEL) {
  this.hits++;
  return JSON.parse(raw) as CachedUrl;
}
this.misses++;
return null;

// Public method for metrics endpoint:
getStats() {
  return {
    hits: this.hits,
    misses: this.misses,
    hitRate: this.hits + this.misses > 0
      ? (this.hits / (this.hits + this.misses) * 100).toFixed(1) + '%'
      : 'N/A',
  };
}
```

### 13.2 Add Metrics Endpoint

Update `HealthController` or create a new controller:

```typescript
@Get('metrics')
getMetrics() {
  return this.cacheService.getStats();
}
```

### 13.3 Pino Log Fields

The cache hit/miss is already logged via `this.logger.debug()` in the `get()` method. For structured observability, add a field to the redirect success log:

```typescript
this.logger.info(
  { id: cached.id, shortCode, source: 'cache' },
  URL_REDIRECT_LOG_MESSAGES.REDIRECT_SUCCESS,
);
```

This lets you filter logs by `source: 'cache'` vs `source: 'db'` to measure cache effectiveness in production.

---

## 14. Redis Memory & TTL Tuning

### Free Tier Constraints (Upstash)

- **10,000 commands/day** on free tier.
- At 100 redirects/day with 50% cache hit rate: ~150 commands/day (well under limit).
- At 10,000 redirects/day: ~15,000 commands/day (over limit — upgrade tier).

### TTL Guidelines

| TTL | Use Case | Tradeoff |
|---|---|---|
| 60s | Aggressive freshness | High DB load, minimal staleness |
| 300s (5min) | Development/testing | Balanced for rapid iteration |
| 3600s (1hr) | **Production default** | Good hit rate, bounded staleness |
| 86400s (24hr) | High-traffic, rarely-changed URLs | Max hit rate, stale risk on mutations |

### Memory Estimate

Each `CachedUrl` JSON is ~200-400 bytes. At 100,000 cached URLs:
- 100K × 300 bytes = ~30MB — well within Redis limits.

### Monitor

```bash
# Check Redis memory usage
redis-cli INFO memory

# Check key count
redis-cli DBSIZE
```

---

## 15. Production Deployment Checklist

- [ ] `REDIS_URL` set in production environment
- [ ] `RedisModule` registered in `AppModule`
- [ ] `RedisService` connects on startup (check logs: `Redis connected`)
- [ ] `/health` returns `redis: 'up'`
- [ ] Cache-aside logic in `redirect()` — verify with logs (`source: 'cache'` vs `source: 'db'`)
- [ ] TTL set (default 3600s)
- [ ] Negative caching enabled (60s TTL)
- [ ] Cache invalidation wired on every mutation (create, update, delete, disable)
- [ ] Both `shortCode` and `customAlias` keys invalidated
- [ ] Cache failures are non-fatal (logged but don't break redirects)
- [ ] Metrics endpoint returns hit/miss counts
- [ ] Unit tests pass for UrlCacheService
- [ ] Unit tests pass for UrlsService.redirect() with cache mocks
- [ ] Integration test confirms cache-aside flow end-to-end
- [ ] Redis connection pool settings tuned (keepAlive, maxRetriesPerRequest)
- [ ] Upstash command budget reviewed against expected traffic

---

## 16. ADR: Why Redis + Cache-Aside

### Status

Accepted

### Context

URL shorteners are read-heavy (~100:1 reads:writes). The redirect path is the hottest code path — every user click triggers it. Database queries for each redirect add latency (typically 10-50ms for PostgreSQL) and database load. We need a caching layer to absorb read traffic.

### Decision

Use **Redis** as a caching layer with the **cache-aside (lazy loading)** pattern.

**Why Redis?**
- Sub-millisecond latency (vs 10-50ms for DB).
- Native TTL support for automatic expiration.
- Simple key-value model fits our access pattern (lookup by shortCode).
- Managed options (Upstash, Redis Cloud) with free tiers.
- Battle-tested at scale (Twitter, GitHub, Stack Overflow).

**Why cache-aside (not write-through or write-back)?**
- **Simple:** No write-path coupling. App code checks cache → miss → DB → populate.
- **Resilient:** If Redis is down, the app still works (just slower, hitting DB directly).
- **Fits read-heavy workload:** Cache population happens on first read, not on every write.
- **No data duplication risk:** Cache is populated from DB, not maintained separately.

### Consequences

**Positive:**
- Redirect latency drops from ~20ms (DB) to ~1-2ms (Redis) on cache hit.
- Database load reduced by ~90%+ for popular URLs.
- TTL bounds staleness automatically.

**Negative:**
- Cache invalidation complexity — every mutation must invalidate.
- Cold start penalty — first request for each code hits DB.
- Negative cache risk — short window where a new code could be shadowed.
- Additional infrastructure (Redis instance to manage/monitor).

**Mitigations:**
- Cache invalidation is enforced by convention (every write method calls `invalidateAll()`).
- TTL bounds staleness to 1 hour (configurable).
- Negative cache TTL is 60s (short enough to not shadow new codes).
- Cache failures are non-fatal (redirects still work via DB).

---

## 17. Interview Notes

### Talking Points

1. **Read:Write Ratio** — URL shorteners are ~100:1 reads:writes. Optimize the read path with caching.

2. **Cache-Aside Pattern** — App checks cache first (GET). On miss, query DB, then populate cache (SET). Resilient: if cache is empty, app works fine.

3. **Cache Invalidation** — The "two hard problems in CS." Every mutation (update, delete, disable) must invalidate the cache. Stale redirects are a real bug — users get redirected to deleted/disabled URLs.

4. **TTL** — Bounds staleness automatically. If an entry is updated, we explicitly invalidate. TTL is a safety net for edge cases.

5. **Negative Caching** — Cache "not found" for a short time to prevent repeated DB hits for garbage codes. Short TTL (60s) so it doesn't shadow new codes.

6. **Thundering Herd** — When a popular cached entry expires, many requests hit the DB simultaneously. Mitigation: stale-while-revalidate (serve stale, refresh in background) or a distributed lock (single fetch, others wait).

7. **Key Schema** — `url:<code>` → JSON object with all fields needed for redirect decision. Cache what you branch on.

8. **Non-Fatal Cache Failures** — Cache is an optimization, not a correctness mechanism. If Redis is down, redirects still work via DB.

---

## File Structure After Implementation

```
src/
├── redis/
│   ├── redis.module.ts
│   └── redis.service.ts
├── urls/
│   ├── cache/
│   │   ├── url-cache.service.ts
│   │   └── url-cache.service.spec.ts
│   ├── constants/
│   │   └── url.constants.ts
│   ├── dto/
│   ├── service/
│   │   ├── urls.service.ts          (modified)
│   │   └── alias-validator.service.ts
│   ├── tests/
│   │   └── urls.service.spec.ts     (modified)
│   ├── urls.controller.ts
│   └── urls.module.ts               (modified)
├── health/
│   ├── health.service.ts             (modified)
│   └── health.module.ts              (modified)
├── config/
│   ├── configuration.ts
│   └── env.schema.ts                 (REDIS_URL already present)
├── app.module.ts                     (modified)
└── main.ts
```

---

## Quick Reference: Commands

```bash
# Install dependencies
pnpm add ioredis
pnpm add -D @types/ioredis

# Run tests
pnpm test

# Run integration tests (requires Redis + Postgres running)
pnpm test:integration

# Check Redis connection
redis-cli -u $REDIS_URL PING

# Monitor Redis commands in dev
redis-cli -u $REDIS_URL MONITOR
```
