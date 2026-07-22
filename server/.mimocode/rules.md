# TinyLink Code Quality Rules

This document defines the coding conventions, patterns, and quality standards for the TinyLink server codebase. All code must follow these rules.

---

## 1. Module Structure

Every feature domain follows this directory layout:

```
src/<feature>/
  <feature>.module.ts          # NestJS module definition
  <feature>.interface.ts       # Domain interfaces
  controllers/
    <feature>.controller.ts    # HTTP layer
  service/
    <feature>.service.ts       # Facade/orchestration service
  use-cases/
    <entity>-<action>.service.ts  # Business logic
  repositories/
    <entity>.repository.ts     # Data access (Prisma wrappers)
  mappers/
    <entity-plural>.mapper.ts  # Entity-to-DTO mapping
  validators/
    <validator>.service.ts     # Validation logic
  dto/
    <entity>.dto.ts            # Zod schemas + inferred types
  constants/
    <feature>.constants.ts     # Constants, error/log messages
  utils/
    helpers.ts                 # Pure utility functions
  tests/                       # Reserved for integration tests
```

Shared infrastructure:
- `src/redis/` — RedisService, RedisModule (global)
- `src/prisma/` — PrismaService, PrismaModule (global)
- `src/config/` — configuration.ts, env.schema.ts
- `src/logger/` — pino.config.ts
- `src/common/` — Shared modules (short-code, zod)
- `src/testing/mocks/` — Shared test mock factories

---

## 2. Import Style

- **ALL imports use relative paths** — no barrel `index.ts` re-exports
- **Import ordering**: `@nestjs/*` first, then third-party, then internal relative
- **Named imports only** — never `import * as` (except for `ua-parser-js` which requires it)
- Use `type` keyword for type-only imports: `import { type ZodType } from 'zod'`

```typescript
// Correct:
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { type ClickJobData } from '../analytics.interface';

// Wrong:
import * as nest from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
```

---

## 3. Dependency Injection

- **All DI fields are `private readonly`** — no exceptions
- Name injected dependencies by their role/purpose:
  - `cache`, `repository`, `mapper`, `validator`
  - `creator`, `redirector` (for use-case services)
  - `prisma`, `redis`, `config` (for infrastructure)
- Use `@InjectQueue('name')` for BullMQ queue injection

```typescript
// Correct:
constructor(
  private readonly cache: UrlCacheService,
  private readonly repository: UrlRepository,
  private readonly mapper: UrlMapper,
) {}

// Wrong:
constructor(
  private cache: UrlCacheService,
  public repository: UrlRepository,
) {}
```

---

## 4. Constants

- All constant objects use `as const` assertion
- Organized into domain-specific files
- Three categories with naming conventions:
  - `*_CONSTANTS` — numeric/string values
  - `*_ERROR_MESSAGES` — error message strings
  - `*_LOG_MESSAGES` — log message strings

```typescript
export const ANALYTICS_CONSTANTS = {
  QUEUE_NAME: 'analytics',
  WORKER_CONCURRENCY: 5,
} as const;

export const ANALYTICS_ERROR_MESSAGES = {
  CLICK_PROCESS_FAILED: 'Failed to process click analytics',
} as const;

export const ANALYTICS_LOG_MESSAGES = {
  CLICK_PROCESSED: 'Click analytics processed',
} as const;
```

---

## 5. Error Handling

- **Always use `error: unknown`** in catch clauses — never `catch (error: Error)`
- Re-throw known HTTP exceptions directly
- Wrap unknown errors as `InternalServerErrorException`

```typescript
async method(): Promise<ReturnType> {
  try {
    // business logic
    throw new NotFoundException(ERROR_MESSAGES.NOT_FOUND);
  } catch (error: unknown) {
    if (error instanceof NotFoundException) {
      throw error;
    }
    this.logger.error({ err: error, ...context }, ERROR_MESSAGE);
    throw new InternalServerErrorException();
  }
}
```

- For cache operations, use graceful degradation:

```typescript
async get(key: string): Promise<T | null> {
  try {
    // cache logic
  } catch (err: unknown) {
    this.logger.warn({ key, err }, 'Cache failed, falling back');
    return null;
  }
}
```

---

## 6. Logging

- **PinoLogger** in business services (use-cases, facade)
- **Logger from @nestjs/common** in infrastructure services (Redis, Worker)
- Set context in constructor: `this.logger.setContext(ClassName.name)`
- Structured logging: context object as first arg, message constant as second

```typescript
// Correct:
this.logger.info({ id: url.id, shortCode }, LOG_MESSAGES.SUCCESS);
this.logger.error({ err: error, shortCode }, ERROR_MESSAGES.FAILED);
this.logger.warn({ shortCode }, 'Non-critical warning');

// Wrong:
this.logger.info('URL created');
this.logger.error(error);
```

---

## 7. DTOs / Validation

- Use **Zod** for all validation — never class-validator
- Export both the schema and the inferred type

```typescript
import { z } from 'zod';

export const createUrlSchema = z.object({
  originalUrl: z.url(),
  customAlias: z.string().min(3).max(30).optional(),
});

export type CreateUrlDto = z.infer<typeof createUrlSchema>;
```

- Use `ZodValidationPipe` in controllers:

```typescript
@Post()
async create(
  @Body(new ZodValidationPipe(createUrlSchema)) dto: CreateUrlDto,
) {}
```

---

## 8. Service Layering

Three tiers:

1. **Controller** — thin HTTP layer, delegates immediately to facade
2. **Facade service** — orchestrates use-cases, contains no business logic
3. **Use-case services** — all business logic lives here

```typescript
// Controller:
async redirect(@Param('shortCode') shortCode: string) {
  return this.urlsService.redirect(shortCode);
}

// Facade:
redirect(shortCode: string, requestMeta?: RequestMeta) {
  return this.redirector.redirect(shortCode, requestMeta);
}

// Use-case:
async redirect(shortCode: string): Promise<string> {
  // all business logic here
}
```

---

## 9. Repository Pattern

- Thin wrappers around PrismaService calls
- No raw queries in repositories (those go to service classes)
- Return Prisma types directly

```typescript
@Injectable()
export class UrlRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UrlCreateInput): Promise<Url> {
    return this.prisma.url.create({ data });
  }

  findByShortCodeOrAlias(shortCode: string): Promise<Url | null> {
    return this.prisma.url.findFirst({
      where: { OR: [{ shortCode }, { customAlias: shortCode }] },
    });
  }
}
```

---

## 10. Mapper Pattern

- Injectable classes that depend on ConfigService (if needed)
- Transform Prisma entities to DTOs or cached representations
- Export the interfaces used by return types

```typescript
@Injectable()
export class AnalyticsMapper {
  toClickResponse(row: AnalyticsRow): ClickResponse {
    return { id: row.id, browser: row.browser, ... };
  }

  toAggregatedResponse(data: AggregatedData): AggregatedResponse {
    return { total: data.total, byBrowser: data.byBrowser.map(...) };
  }
}
```

---

## 11. Test Conventions

- Test files: `<source-file-name>.spec.ts` in the same directory
- Describe block suffix: `(unit)` for unit tests
- Use `jest.clearAllMocks()` in `beforeEach`
- Mock objects at describe scope, not inside `beforeEach`
- Use `Test.createTestingModule` with `{ provide: X, useValue: mock }`

```typescript
describe('SomeService (unit)', () => {
  let service: SomeService;

  const mockDep = {
    method: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        SomeService,
        { provide: SomeDep, useValue: mockDep },
      ],
    }).compile();

    service = module.get(SomeService);
  });

  it('does something', async () => {
    mockDep.method.mockResolvedValue(expected);
    const result = await service.method(input);
    expect(result).toEqual(expected);
  });
});
```

---

## 12. Formatting

- Single quotes for strings
- Trailing commas everywhere
- 2-space indentation
- Semicolons always
- Prettier config: `{ "singleQuote": true, "trailingComma": "all" }`

---

## 13. Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Files | kebab-case | `urls.service.ts`, `url-create.service.ts` |
| Classes | PascalCase | `UrlCreateService`, `AnalyticsWorker` |
| Methods | camelCase | `processClick`, `getAggregated` |
| Constants | SCREAMING_SNAKE | `QUEUE_NAME`, `MAX_ATTEMPTS` |
| Interfaces | PascalCase | `ClickJobData`, `CachedUrl` |
| Test describe | `ClassName (unit)` | `UrlRedirectService (unit)` |

---

## 14. BullMQ Queue Pattern

- Queue class extends `Queue` and implements `OnModuleDestroy`
- Worker class implements `OnModuleDestroy`
- Fire-and-forget enqueue with `.catch()`:

```typescript
this.queue.add('jobName', data).catch((err: unknown) => {
  this.logger.warn({ err, ...context }, 'Failed to enqueue');
});
```

---

## 15. Environment Validation

- Use Zod schema at startup in `env.schema.ts`
- Configuration function validates on load
- Use `ConfigService.getOrThrow()` for required values

```typescript
export const envSchema = z.object({
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  IP_HASH_SALT: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;
```
