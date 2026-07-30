import { Test, TestingModule } from '@nestjs/testing';

import { ThrottlerRedisStorage } from './throttler-redis-storage';
import { RedisService } from '../../redis/service/redis.service';

describe('ThrottlerRedisStorage', () => {
  let storage: ThrottlerRedisStorage;

  const redis = {
    eval: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThrottlerRedisStorage,
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    storage = module.get(ThrottlerRedisStorage);
  });

  it('should be defined', () => {
    expect(storage).toBeDefined();
  });

  describe('increment', () => {
    it('should increment and return record for normal request', async () => {
      redis.eval.mockResolvedValue([1, 59000, 0, 0]);

      const result = await storage.increment(
        'test-key',
        60000,
        10,
        60000,
        'default',
      );

      expect(result).toEqual({
        totalHits: 1,
        timeToExpire: 59,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
      expect(redis.eval).toHaveBeenCalledWith(
        expect.any(String),
        2,
        'throttle:test-key',
        'throttle:block:test-key',
        60000,
        10,
        60000,
        expect.any(Number),
      );
    });

    it('should return blocked when limit exceeded', async () => {
      redis.eval.mockResolvedValue([11, 5000, 1, 60000]);

      const result = await storage.increment(
        'test-key',
        60000,
        10,
        60000,
        'default',
      );

      expect(result).toEqual({
        totalHits: 11,
        timeToExpire: 5,
        isBlocked: true,
        timeToBlockExpire: 60,
      });
    });

    it('should use ttl when currentTtlMs is negative', async () => {
      redis.eval.mockResolvedValue([1, -1, 0, 0]);

      const result = await storage.increment(
        'test-key',
        60000,
        10,
        60000,
        'default',
      );

      expect(result.timeToExpire).toBe(60);
    });
  });
});
