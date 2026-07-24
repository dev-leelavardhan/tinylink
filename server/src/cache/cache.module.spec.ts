import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { CacheModule } from './cache.module';
import { CacheService } from './service/cache.service';
import { RedisService } from '../redis/service/redis.service';

describe('CacheModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    const mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    };

    const mockLogger = {
      setContext: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: RedisService, useValue: mockRedis },
        { provide: PinoLogger, useValue: mockLogger },
      ],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('provides CacheService', () => {
    expect(module.get(CacheService)).toBeDefined();
  });

  it('exports CacheService', () => {
    const exports =
      (Reflect.getMetadata('exports', CacheModule) as unknown[]) || [];
    expect(exports).toContain(CacheService);
  });
});
