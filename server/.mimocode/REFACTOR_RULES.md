# Refactoring Rules - TinyLink Server

Based on the Analytics module patterns for consistent module refactoring.

---

## 1. Folder Structure

```
src/
└── [module]/
    ├── [module].module.ts          # NestJS module definition
    ├── types.ts                    # Module-specific TypeScript interfaces
    ├── constants/
    │   └── [module].constants.ts   # Constants, log messages, error messages
    ├── controllers/
    │   ├── [module].controller.ts
    │   └── [module].controller.spec.ts
    ├── dto/
    │   ├── [module]-query.dto.ts
    │   └── [module]-query.dto.spec.ts
    ├── mappers/
    │   ├── [module].mapper.ts
    │   ├── [module].mapper.spec.ts
    │   └── types.ts                # Mapper-specific types
    ├── queue/                      # (if async processing needed)
    │   ├── [module].queue.ts
    │   ├── [module].queue.spec.ts
    │   ├── [module]-cleanup.scheduler.ts
    │   └── [module]-cleanup.scheduler.spec.ts
    ├── repositories/
    │   ├── [module].repository.ts
    │   └── [module].repository.spec.ts
    ├── service/
    │   ├── [module].service.ts     # Thin facade service
    │   └── [module].service.spec.ts
    ├── use-cases/
    │   ├── [module]-action.service.ts    # One service per use case
    │   └── [module]-action.service.spec.ts
    ├── utils/
    │   ├── helpers.ts
    │   └── helpers.spec.ts
    └── worker/                     # (if queue-based processing)
        ├── [module].worker.ts
        └── [module].worker.spec.ts
```

**Rules:**
- Create all subdirectories even if some are empty initially
- Every source file must have a co-located `.spec.ts` test file
- No barrel/index.ts files — every import is a direct file import
- No absolute path aliases — all imports use relative paths

---

## 2. Module Definition (`*.module.ts`)

```typescript
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

import { ModuleController } from './controllers/module.controller';
import { ModuleMapper } from './mappers/module.mapper';
import { ModuleQueue } from './queue/module.queue';
import { ModuleCleanupScheduler } from './queue/module-cleanup.scheduler';
import { ModuleRepository } from './repositories/module.repository';
import { ModuleService } from './service/module.service';
import { ModuleReadService } from './use-cases/module-read.service';
import { ModuleWriteService } from './use-cases/module-write.service';
import { ModuleCleanupService } from './use-cases/module-cleanup.service';
import { ModuleWorker } from './worker/module.worker';

@Module({
  imports: [PrismaModule, RedisModule],

  controllers: [ModuleController],

  providers: [
    // Infrastructure
    ModuleQueue,
    ModuleWorker,
    ModuleCleanupScheduler,

    // Application (use-cases)
    ModuleService,
    ModuleReadService,
    ModuleWriteService,
    ModuleCleanupService,

    // Persistence
    ModuleRepository,

    // Mapping
    ModuleMapper,
  ],

  exports: [ModuleService, ModuleQueue],
})
export class ModuleNameModule {}
```

**Rules:**
- Group providers by layer with comments: Infrastructure → Application → Persistence → Mapping
- External module imports (`../`) go at the top, separated by blank line
- Internal module imports (`./`) go after external imports
- Export only the facade service and queue (if applicable)
- Never export use-case services, repository, mapper, or worker
- Import shared infrastructure modules (PrismaModule, RedisModule)

---

## 3. Constants (`constants/*.constants.ts`)

```typescript
export const MODULE_CONSTANTS = {
  // Queue
  QUEUE_NAME: 'module',
  JOB_ACTION: 'action',
  JOB_CLEANUP: 'cleanup',

  // Worker
  WORKER_CONCURRENCY: 5,

  // Cleanup
  CLEANUP_CRON: '0 2 * * *',
  CLEANUP_JOB_ID: 'module-cleanup',
  DEFAULT_RETENTION_DAYS: 90,

  // Pagination
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,

  // Feature-specific
  DEFAULT_DAYS: 30,
  MAX_DAYS: 365,
} as const;

export const MODULE_LOG_MESSAGES = {
  ACTION_STARTED: 'Starting action',
  ACTION_COMPLETED: 'Action completed',
  CLEANUP_STARTED: 'Starting cleanup',
  CLEANUP_COMPLETED: 'Cleanup completed',
  WORKER_STARTED: 'Worker started',
} as const;

export const MODULE_ERROR_MESSAGES = {
  ACTION_FAILED: 'Failed to perform action',
  CLEANUP_FAILED: 'Cleanup failed',
  WORKER_ERROR: 'Worker error',
  DATABASE_ERROR: 'Database error',
} as const;
```

**Rules:**
- Export three separate `as const` objects: `MODULE_CONSTANTS`, `MODULE_LOG_MESSAGES`, `MODULE_ERROR_MESSAGES`
- Organize constants by category with comments (Queue, Worker, Cleanup, Pagination, Feature)
- Use `UPPER_SNAKE_CASE` for all constant keys
- Use descriptive suffixes: `_MS`, `_SECONDS`, `_DAYS`, `_MAX`, `_DEFAULT`, `_CRON`
- Computed values inline: `COMPLETED_JOB_MAX_AGE_SECONDS: 7 * 86_400`
- No magic numbers or strings anywhere in the codebase — all values come from constants
- Log messages are DRY — defined once in constants, used everywhere

---

## 4. Controller Pattern (`controllers/*.controller.ts`)

```typescript
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe';
import { AnalyticsService } from '../service/analytics.service';
import {
  type AnalyticsQueryDto,
  analyticsQuerySchema,
} from '../dto/analytics-query.dto';

@Controller('urls/:urlId/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  getAggregated(
    @Param('urlId') urlId: string,
    @Query(new ZodValidationPipe(analyticsQuerySchema)) query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getAggregated(urlId, query.days);
  }

  @Get('clicks')
  getRecentClicks(
    @Param('urlId') urlId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQueryDto,
  ) {
    return this.analyticsService.getRecentClicks(urlId, query.page, query.limit);
  }
}
```

**Rules:**
- Controllers are thin — delegate ALL logic to the facade service immediately
- No try/catch in controllers — exceptions propagate naturally to NestJS exception filters
- No async/await unless needed — return promises directly
- Use `ZodValidationPipe` for query parameter validation
- Import DTO types as `type` (`import { type AnalyticsQueryDto }`)
- Import schema objects as values (`import { analyticsQuerySchema }`)
- RESTful route naming: `:resourceId/[module]` pattern
- Separate endpoints for different data shapes (aggregated vs list)

---

## 5. DTO Pattern (`dto/*.dto.ts`)

```typescript
import { z } from 'zod';
import { ANALYTICS_CONSTANTS } from '../constants/analytics.constants';

export const analyticsQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .min(1)
    .max(ANALYTICS_CONSTANTS.MAX_ANALYTICS_DAYS)
    .default(ANALYTICS_CONSTANTS.DEFAULT_ANALYTICS_DAYS),
});

export type AnalyticsQueryDto = z.infer<typeof analyticsQuerySchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(ANALYTICS_CONSTANTS.MAX_PAGE_SIZE)
    .default(ANALYTICS_CONSTANTS.DEFAULT_PAGE_SIZE),
});

export type PaginationQueryDto = z.infer<typeof paginationQuerySchema>;
```

**Rules:**
- Use Zod for schema validation and type inference
- Export both schema (value) and inferred type (`z.infer`)
- Import constants for default/max values — no magic numbers
- Use `z.coerce` for query parameters (always strings from URL)
- Provide sensible defaults via `.default()`
- Multiple schemas in one file when small and related
- Schema names use `camelCase` with `Schema` suffix
- Type names use `PascalCase` with `Dto` suffix

---

## 6. Mapper Pattern (`mappers/*.mapper.ts`)

### Mapper Types (`mappers/types.ts`)

```typescript
// Internal types (not exported)
interface BrowserGroup {
  browser: string;
  _count: { id: number };
}

interface CountryGroup {
  country: string;
  _count: { id: number };
}

// Exported types for API boundary
export interface AnalyticsRow {
  id: string;
  urlId: string;
  timestamp: Date;
  browser: string;
  country: string;
  device: string;
}

export interface AggregatedResponse {
  total: number;
  byBrowser: { browser: string; count: number }[];
  byCountry: { country: string; count: number }[];
}

export interface AggregatedData {
  total: number;
  byBrowser: BrowserGroup[];
  byCountry: CountryGroup[];
}
```

### Mapper Implementation (`mappers/*.mapper.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import {
  type AnalyticsRow,
  type AggregatedData,
  type AggregatedResponse,
} from './types';

@Injectable()
export class AnalyticsMapper {
  toClickResponse(row: AnalyticsRow): AnalyticsRow {
    return { ...row };
  }

  toAggregatedResponse(data: AggregatedData): AggregatedResponse {
    return {
      total: Number(data.total),
      byBrowser: data.byBrowser.map(({ browser, _count }) => ({
        browser,
        count: Number(_count),
      })),
      byCountry: data.byCountry.map(({ country, _count }) => ({
        country,
        count: Number(_count),
      })),
    };
  }
}
```

**Rules:**
- Mappers are stateless `@Injectable()` services
- Transform persistence types → response types
- Handle `bigint` → `number` conversion explicitly (Prisma returns `bigint` for counts)
- Keep mapper logic simple (avoid complex transformations)
- Define mapper-specific types in `mappers/types.ts`
- Internal types (not used outside mapper) are not exported
- Exported types are for API boundary (controller responses, repository returns)
- Mapper tests use direct instantiation: `mapper = new AnalyticsMapper()`

---

## 7. Repository Pattern (`repositories/*.repository.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface AnalyticsFilter {
  urlId: string;
  since: Date;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.AnalyticsCreateInput) {
    return this.prisma.analytics.create({ data });
  }

  findById(id: string) {
    return this.prisma.analytics.findUnique({ where: { id } });
  }

  countByFilter(filter: AnalyticsFilter): Promise<number> {
    return this.prisma.analytics.count({
      where: this.buildFilter(filter.urlId, filter.since),
    });
  }

  groupByBrowser(urlId: string, since: Date) {
    return this.prisma.analytics.groupBy({
      by: ['browser'],
      where: this.buildFilter(urlId, since),
      _count: true,
      orderBy: { _count: { browser: 'desc' } },
    });
  }

  findRecentClicks(urlId: string, skip: number, take: number) {
    return this.prisma.analytics.findMany({
      where: { urlId },
      select: {
        id: true,
        timestamp: true,
        browser: true,
        country: true,
        device: true,
      },
      orderBy: { timestamp: 'desc' },
      skip,
      take,
    });
  }

  deleteOldAnalytics(retentionDate: Date) {
    return this.prisma.analytics.deleteMany({
      where: { timestamp: { lt: retentionDate } },
    });
  }

  private buildFilter(urlId: string, since: Date): Prisma.AnalyticsWhereInput {
    return {
      urlId,
      timestamp: { gte: since },
    };
  }
}
```

**Rules:**
- Repositories encapsulate ALL database access
- Use PrismaService for all database operations
- One method per database operation — single responsibility
- Define filter interfaces inside the repository file (not exported)
- Use private helper methods for reusable filter building
- Return Prisma promises directly (no wrapping)
- Use `$queryRaw` only when Prisma ORM doesn't support the query
- Use explicit `select` to avoid returning sensitive fields
- Return types are explicit on methods that need them

---

## 8. Service Layer Pattern

### Facade Service (`service/*.service.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { ModuleReadService } from '../use-cases/module-read.service';

@Injectable()
export class ModuleService {
  constructor(private readonly readService: ModuleReadService) {}

  getAggregated(resourceId: string, days: number) {
    return this.readService.getAggregated(resourceId, days);
  }

  getItems(resourceId: string, page: number, limit: number) {
    return this.readService.getItems(resourceId, page, limit);
  }
}
```

**Rules:**
- Facade service is a PURE DELEGATION wrapper — no logic, no logging, no try/catch
- No PinoLogger needed in facade — zero logic means zero logging
- Located in `service/` directory (not `use-cases/`)
- This is what the module exports to other modules
- Routes calls to the appropriate use-case service

### Use-Case Services (`use-cases/*.service.ts`)

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { ModuleRepository } from '../repositories/module.repository';
import { ModuleMapper } from '../mappers/module.mapper';
import { MODULE_CONSTANTS } from '../constants/module.constants';
import { type ClickJobData } from '../types';
import { daysAgo } from '../utils/helpers';

@Injectable()
export class ModuleReadService {
  constructor(
    private readonly repository: ModuleRepository,
    private readonly mapper: ModuleMapper,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ModuleReadService.name);
  }

  async getAggregated(resourceId: string, days: number) {
    const since = daysAgo(days);

    const [total, grouped] = await Promise.all([
      this.repository.countByFilter({ resourceId, since }),
      this.repository.groupByField(resourceId, since),
    ]);

    return this.mapper.toAggregatedResponse({ total, grouped });
  }

  async getItems(resourceId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.repository.findMany(resourceId, skip, limit),
      this.repository.countByFilter({ resourceId, since: ALL_TIME }),
    ]);

    return {
      items: items.map((item) => this.mapper.toItemResponse(item)),
      total: Number(total),
      page,
      limit,
      pages: Math.ceil(Number(total) / limit),
    };
  }
}
```

**Rules:**
- Use-case services contain ALL business logic
- One use-case service per logical operation (Read, Write, Cleanup)
- Always inject `PinoLogger` via constructor and call `setContext(ClassName.name)`
- Use `Promise.all()` for independent parallel queries
- Calculate pagination offsets: `skip = (page - 1) * limit`
- Return consistent response shapes with pagination metadata
- Use `OnModuleInit` lifecycle hook when initialization is needed
- Config access via `config.getOrThrow<string>('KEY')` — fails fast on missing config

---

## 9. Queue Pattern (`queue/*.queue.ts`)

```typescript
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { MODULE_CONSTANTS } from '../constants/module.constants';

@Injectable()
export class ModuleQueue extends Queue implements OnModuleDestroy {
  constructor(config: ConfigService) {
    const redisUrl = config.getOrThrow<string>('REDIS_URL');

    super(MODULE_CONSTANTS.QUEUE_NAME, {
      connection: {
        url: redisUrl,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: MODULE_CONSTANTS.MAX_JOB_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: MODULE_CONSTANTS.JOB_BACKOFF_DELAY_MS,
        },
        removeOnComplete: {
          age: MODULE_CONSTANTS.COMPLETED_JOB_MAX_AGE_SECONDS,
        },
        removeOnFail: {
          age: MODULE_CONSTANTS.FAILED_JOB_MAX_AGE_SECONDS,
        },
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
```

**Rules:**
- Extend BullMQ `Queue` class directly
- `super()` called in constructor with queue name and options
- Default job options configured at queue level (attempts, backoff, retention)
- Use `OnModuleDestroy` for cleanup: `async onModuleDestroy() { await this.close(); }`
- Config injected but not stored as property (consumed in constructor only)
- Always set `maxRetriesPerRequest: null` for Redis
- Exported from the module so other modules can enqueue jobs

---

## 10. Worker Pattern (`worker/*.worker.ts`)

```typescript
import { Worker, type Job } from 'bullmq';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { MODULE_CONSTANTS } from '../constants/module.constants';
import { type ClickJobData } from '../types';

@Injectable()
export class ModuleWorker implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker<ClickJobData>;

  constructor(
    private readonly config: ConfigService,
    private readonly actionService: ActionService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ModuleWorker.name);
  }

  onModuleInit(): void {
    this.worker = new Worker<ClickJobData>(
      MODULE_CONSTANTS.QUEUE_NAME,
      async (job) => this.processJob(job),
      {
        connection: {
          url: this.config.getOrThrow<string>('REDIS_URL'),
          maxRetriesPerRequest: null,
        },
        concurrency: MODULE_CONSTANTS.WORKER_CONCURRENCY,
      },
    );

    this.registerEvents();
    this.logger.info({ queue: MODULE_CONSTANTS.QUEUE_NAME }, 'Worker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(job: Job<ClickJobData>): Promise<void> {
    switch (job.name) {
      case MODULE_CONSTANTS.JOB_ACTION:
        await this.actionService.process(job.data);
        break;
      default:
        this.logger.warn({ jobName: job.name }, 'Unknown job');
    }
  }

  private registerEvents(): void {
    this.worker.on('completed', (job) => {
      this.logger.debug({ jobId: job.id }, 'Job completed');
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error({ jobId: job?.id, err }, 'Job failed');
    });

    this.worker.on('error', (err) => {
      this.logger.error({ err }, 'Worker error');
    });
  }
}
```

**Rules:**
- Implement both `OnModuleInit` and `OnModuleDestroy`
- Worker created in `onModuleInit()` (not constructor)
- Generic type parameter on Worker: `Worker<JobData>`
- Use switch/case dispatch based on `job.name` to different use-case services
- Register event handlers in a separate private `registerEvents()` method
- Three event handlers: `completed`, `failed`, `error`
- Use `?.` for safe property access in error handlers (`job?.id`, `job?.data?.shortCode`)
- `OnModuleDestroy` with optional chaining: `await this.worker?.close()`
- Worker NOT exported from the module (internal infrastructure)
- Log context with queue name on startup

---

## 11. Scheduler Pattern (`queue/*-cleanup.scheduler.ts`)

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { MODULE_CONSTANTS } from '../constants/module.constants';
import { ModuleQueue } from './module.queue';

@Injectable()
export class ModuleCleanupScheduler implements OnModuleInit {
  constructor(
    private readonly queue: ModuleQueue,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ModuleCleanupScheduler.name);
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      MODULE_CONSTANTS.JOB_CLEANUP,
      {},
      {
        repeat: { pattern: MODULE_CONSTANTS.CLEANUP_CRON },
        jobId: MODULE_CONSTANTS.CLEANUP_JOB_ID,
      },
    );

    this.logger.info({ cron: MODULE_CONSTANTS.CLEANUP_CRON }, 'Cleanup scheduled');
  }
}
```

**Rules:**
- Implement `OnModuleInit` to schedule on startup
- Inject the concrete `ModuleQueue` class (not Queue token)
- Use unique `jobId` to prevent duplicate scheduled jobs
- Cron pattern from constants — no magic strings
- Log the cron pattern for debugging
- Keep scheduler logic minimal — delegate to worker

---

## 12. Helper Utilities (`utils/helpers.ts`)

```typescript
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type DeviceType = 'Desktop' | 'Mobile' | 'Tablet' | 'Other';

export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: DeviceType;
}

// ============================================================================
// Constants
// ============================================================================

const MILLISECONDS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

const MILLISECONDS_PER_DAY =
  MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;

// ============================================================================
// Time Utilities
// ============================================================================

export const ALL_TIME = new Date(0);

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * MILLISECONDS_PER_DAY);
}

// ============================================================================
// Security Utilities
// ============================================================================

export function hashValue(value: string | undefined, salt: string): string {
  return createHash('sha256')
    .update(`${salt}${value ?? ''}`)
    .digest('hex');
}

// ============================================================================
// URL Utilities
// ============================================================================

export function normalizeUrl(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
```

**Rules:**
- Organize helpers into logical sections with banner comments (`// ====...====`)
- Section order: Types → Constants (private) → Time Utilities → Security Utilities → URL Utilities
- Private constants (not exported): `MILLISECONDS_PER_SECOND`, etc.
- Export commonly used helpers: `daysAgo`, `ALL_TIME`
- Keep pure functions — no side effects, no class wrapping
- Use `undefined` checks before operations
- Defensive coding: try/catch for URL parsing, handle undefined with `?? ''`
- Types exported alongside their implementations

---

## 13. Types Pattern (`types.ts`)

```typescript
// Module-level types only — no shared types here
export interface ClickJobData {
  urlId: string;
  shortCode: string;
  userAgent: string;
  referrer?: string;
  ip?: string;
}

export interface ProcessResult {
  success: boolean;
  processedAt: Date;
}
```

**Rules:**
- Keep module-specific types in root `types.ts`
- Complex mapper types go in `mappers/types.ts`
- Use `interface` for object shapes
- Use `type` for unions and aliases
- Export all types that are used across the module
- Import types using `type` keyword: `import { type ClickJobData } from '../types'`
- Optional fields marked with `?`

---

## 14. Logging Pattern

### Preferred: PinoLogger via Constructor Injection

```typescript
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class SomeService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(SomeService.name);
  }

  async doSomething() {
    this.logger.info('Starting operation');
    this.logger.info({ resourceId, count }, 'Operation completed');
    this.logger.warn({ reason }, 'Warning message');
    this.logger.error({ err }, 'Error message');
  }
}
```

### Avoid: Logger Class Instantiation

```typescript
// ❌ DO NOT USE - Only for infrastructure/low-level classes
import { Logger } from '@nestjs/common';

@Injectable()
export class SomeService {
  private readonly logger = new Logger(SomeService.name); // Avoid this pattern
  // ...
}
```

**Rules:**
- **Always use `PinoLogger` from `nestjs-pino` via constructor injection** for all application services
- **Avoid `new Logger()` from `@nestjs/common`** — only use it in infrastructure classes that cannot receive DI (e.g., classes extending external libraries like Redis/ioredis)
- Always set context to class name in constructor using `this.logger.setContext(ClassName.name)`
- Use structured logging with objects for context
- Log meaningful operations (start, complete, error)
- Include relevant IDs and metrics in log objects

**Logging call patterns:**
- Structured object + message: `this.logger.info({ database: this.path }, 'Database loaded')`
- Object with `err` field: `this.logger.error({ err }, 'Operation failed')`
- Simple message only: `this.logger.info('Starting operation')`
- Debug level for completed jobs: `this.logger.debug({ jobId: job.id }, 'Job completed')`
- Warn level for unknown jobs: `this.logger.warn({ jobName: job.name }, 'Unknown job')`

**When to use `new Logger()` (exceptions only):**
- Classes extending external libraries (e.g., `RedisService extends Redis`)
- Value objects or utilities that are not injectable
- Entry point files (main.ts)

**When to use `PinoLogger` (default for all services):**
- All NestJS injectable services
- Use-case services
- Workers and schedulers
- Any class that receives dependencies via DI

---

## 15. Testing Pattern

### Service Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ModuleService } from './module.service';
import { ModuleReadService } from '../use-cases/module-read.service';
import { PinoLogger } from 'nestjs-pino';

describe('ModuleService', () => {
  let service: ModuleService;
  let readService: {
    getAggregated: jest.Mock;
    getItems: jest.Mock;
  };

  beforeEach(async () => {
    readService = {
      getAggregated: jest.fn(),
      getItems: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModuleService,
        { provide: ModuleReadService, useValue: readService },
      ],
    }).compile();

    service = module.get(ModuleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAggregated', () => {
    it('should call readService.getAggregated with correct params', async () => {
      const expected = { total: 100 };
      readService.getAggregated.mockResolvedValue(expected);

      const result = await service.getAggregated('url-id', 30);

      expect(readService.getAggregated).toHaveBeenCalledWith('url-id', 30);
      expect(result).toEqual(expected);
    });
  });
});
```

### Repository Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ModuleRepository } from './module.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('ModuleRepository', () => {
  let repository: ModuleRepository;
  let prisma: {
    analytics: {
      create: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      analytics: {
        create: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModuleRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(ModuleRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });
});
```

### Mapper Tests (Direct Instantiation)

```typescript
import { AnalyticsMapper } from './analytics.mapper';

describe('AnalyticsMapper', () => {
  let mapper: AnalyticsMapper;

  beforeEach(() => {
    mapper = new AnalyticsMapper();
  });

  describe('toAggregatedResponse', () => {
    it('should convert bigint counts to numbers', () => {
      const data = {
        total: BigInt(100),
        byBrowser: [{ browser: 'Chrome', _count: { id: BigInt(50) } }],
      };

      const result = mapper.toAggregatedResponse(data);

      expect(result.total).toBe(100);
      expect(result.byBrowser[0].count).toBe(50);
    });
  });
});
```

### DTO Tests (Direct Schema Parse)

```typescript
import { analyticsQuerySchema } from './analytics-query.dto';
import { ANALYTICS_CONSTANTS } from '../constants/analytics.constants';

describe('analyticsQuerySchema', () => {
  it('applies default days value', () => {
    const result = analyticsQuerySchema.parse({});
    expect(result.days).toBe(ANALYTICS_CONSTANTS.DEFAULT_ANALYTICS_DAYS);
  });

  it('validates days minimum', () => {
    expect(() => analyticsQuerySchema.parse({ days: 0 })).toThrow();
  });

  it('validates days maximum', () => {
    expect(() =>
      analyticsQuerySchema.parse({ days: ANALYTICS_CONSTANTS.MAX_ANALYTICS_DAYS + 1 }),
    ).toThrow();
  });
});
```

### External Library Mocks

```typescript
jest.mock('node:fs/promises', () => ({
  access: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('maxmind', () => ({
  open: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue({ country: { iso_code: 'US' } }),
  }),
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({}),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));
```

**Rules:**
- Every source file must have a co-located `.spec.ts` test file
- Use manual inline mock objects with explicit method signatures (not `jest.Mocked<T>`)
- Only define methods that are actually called in tests
- Mock at the service boundary using `useValue`
- Mapper tests use direct instantiation (no DI container)
- DTO tests use direct schema parse calls (no DI container)
- Use `jest.mock()` only for external libraries (fs, maxmind, bullmq)
- Use `describe` / `beforeEach` / `it` structure throughout
- Test one behavior per `it` block
- Describe both success and error cases
- Use `expect.any(Date)` for dynamic values
- Use `expect.objectContaining({...})` for partial matching
- Use `expect(...).rejects.toThrow('message')` for async error testing

---

## 16. Dependency Injection Hierarchy

```
Controller
    ↓
Facade Service
    ↓
Use-Case Services (Read/Write/Cleanup)
    ↓
Repository
    ↓
PrismaService
```

**Rules:**
- Controllers depend only on facade services
- Facade services delegate to use-case services
- Use-case services depend on repository and mapper
- Repositories depend only on PrismaService
- Never skip layers (e.g., controller → repository)
- Workers depend on use-case services (not repository directly)
- Schedulers depend on queue (not use-case services)

---

## 17. Error Handling

```typescript
// In use-case services
async doOperation(): Promise<void> {
  this.logger.info('Starting operation');

  try {
    const result = await this.repository.doWork();
    this.logger.info({ count: result.count }, 'Operation completed');
  } catch (err: unknown) {
    this.logger.error({ err }, 'Operation failed');
    throw err; // Re-throw for upstream handling
  }
}

// Graceful degradation (non-critical operations)
async lookupCountry(ip: string): Promise<string | null> {
  try {
    const result = this.geoIpReader.get(ip);
    return result?.country?.iso_code ?? null;
  } catch (err: unknown) {
    this.logger.warn({ err, ip }, 'Failed to resolve country');
    return null; // Graceful degradation
  }
}
```

**Rules:**
- Use try/catch only at use-case boundaries
- Always type errors as `err: unknown` (never `Error`)
- Log errors with structured `{ err }` object before re-throwing
- Never swallow errors silently — always log
- Use graceful degradation for non-critical operations (returns null/empty)
- Let infrastructure handle retries (queue backoff)
- No try/catch in controllers — exceptions propagate naturally
- DTO validation errors throw `BadRequestException` via Zod

---

## 18. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Module file | `[module].module.ts` | `analytics.module.ts` |
| Controller | `[Module]Controller` | `AnalyticsController` |
| Facade Service | `[Module]Service` | `AnalyticsService` |
| Use-Case | `[Module][Action]Service` | `AnalyticsReadService` |
| Repository | `[Module]Repository` | `AnalyticsRepository` |
| Mapper | `[Module]Mapper` | `AnalyticsMapper` |
| Mapper Types | `types.ts` (in mappers/) | `mappers/types.ts` |
| Queue | `[Module]Queue` | `AnalyticsQueue` |
| Worker | `[Module]Worker` | `AnalyticsWorker` |
| Scheduler | `[Module]CleanupScheduler` | `AnalyticsCleanupScheduler` |
| DTO Schema | `[module]QuerySchema` | `analyticsQuerySchema` |
| DTO Type | `[Module]QueryDto` | `AnalyticsQueryDto` |
| Constants | `[module].constants.ts` | `analytics.constants.ts` |
| Constants Object | `[MODULE]_CONSTANTS` | `ANALYTICS_CONSTANTS` |
| Log Messages | `[MODULE]_LOG_MESSAGES` | `ANALYTICS_LOG_MESSAGES` |
| Error Messages | `[MODULE]_ERROR_MESSAGES` | `ANALYTICS_ERROR_MESSAGES` |
| Spec | `[file].spec.ts` | `analytics.service.spec.ts` |

---

## 19. Import Order

```typescript
// 1. NestJS / Framework
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

// 2. Third-party
import { z } from 'zod';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { Prisma } from '@prisma/client';
import type { CountryResponse, Reader } from 'maxmind';
import { open } from 'maxmind';

// 3. Node.js built-in
import { createHash } from 'crypto';
import { access } from 'node:fs/promises';

// 4. Shared modules (cross-module, ../)
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/service/redis.service';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe';

// 5. Module imports (internal, ./ or ../ within module)
import { MODULE_CONSTANTS } from '../constants/module.constants';
import { ModuleRepository } from '../repositories/module.repository';
import { type ClickJobData } from '../types';
```

**Rules:**
- Group imports in order: NestJS → Third-party → Node.js built-in → Shared modules → Module imports
- Separate each group with a blank line
- Use `import type` for type-only imports
- Use `type` keyword in named imports: `import { type ClickJobData }`
- No barrel re-exports — every import is a direct file path
- No absolute path aliases — all imports use relative paths

---

## 20. Quick Refactoring Checklist

- [ ] Create folder structure following Section 1
- [ ] Define module in `*.module.ts` with proper provider grouping
- [ ] Create three constants objects: `MODULE_CONSTANTS`, `MODULE_LOG_MESSAGES`, `MODULE_ERROR_MESSAGES`
- [ ] Create controller with Zod validation (thin, no business logic)
- [ ] Create DTOs with Zod schemas and inferred types
- [ ] Create mapper with `types.ts` for response transformations
- [ ] Create repository with Prisma queries and filter helpers
- [ ] Create facade service (pure delegation, no logging)
- [ ] Create use-case services (one per operation, with PinoLogger)
- [ ] Add queue if async processing needed (extends Queue, OnModuleDestroy)
- [ ] Add worker if queue-based processing (OnModuleInit + OnModuleDestroy)
- [ ] Add scheduler for recurring jobs (OnModuleInit, unique jobId)
- [ ] Extract helpers to utils (pure functions, banner section headers)
- [ ] Use `PinoLogger` via constructor injection (not `new Logger()`)
- [ ] Write tests for each file (manual inline mocks, not jest.Mocked)
- [ ] Export public API from module (facade service + queue only)
- [ ] Follow import order: NestJS → Third-party → Node.js → Shared → Module
