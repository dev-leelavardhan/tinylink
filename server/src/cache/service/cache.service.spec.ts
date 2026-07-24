import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { RedisService } from '../../redis/service/redis.service';
import { CACHE_CONSTANTS } from '../constants/cache.constants';
import { PinoLogger } from 'nestjs-pino';

describe('CacheService', () => {
  let service: CacheService;
  let redis: {
    get: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(async () => {
    redis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: RedisService, useValue: redis },
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should return null on cache miss', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.get('test-code');

      expect(result).toBeNull();
      expect(redis.get).toHaveBeenCalledWith(
        `${CACHE_CONSTANTS.KEY_PREFIX}test-code`,
      );
    });

    it('should return null on negative cache hit', async () => {
      redis.get.mockResolvedValue(CACHE_CONSTANTS.NEGATIVE_SENTINEL);

      const result = await service.get('test-code');

      expect(result).toBeNull();
    });

    it('should return parsed CachedUrl on cache hit', async () => {
      const cachedData = {
        id: '1',
        originalUrl: 'https://example.com',
        shortCode: 'test-code',
        customAlias: null,
        disabled: false,
        expiresAt: null,
        lastAccessedAt: null,
      };
      redis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.get('test-code');

      expect(result).toEqual(cachedData);
    });

    it('should return null on parse error', async () => {
      redis.get.mockResolvedValue('invalid-json');

      const result = await service.get('test-code');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should store data with TTL', async () => {
      redis.setex.mockResolvedValue('OK');

      const data = {
        id: '1',
        originalUrl: 'https://example.com',
        shortCode: 'test-code',
        customAlias: null,
        disabled: false,
        expiresAt: null,
        lastAccessedAt: null,
      };

      await service.set('test-code', data);

      expect(redis.setex).toHaveBeenCalledWith(
        `${CACHE_CONSTANTS.KEY_PREFIX}test-code`,
        CACHE_CONSTANTS.DEFAULT_TTL_SECONDS,
        JSON.stringify(data),
      );
    });
  });

  describe('setNegative', () => {
    it('should store negative cache with shorter TTL', async () => {
      redis.setex.mockResolvedValue('OK');

      await service.setNegative('test-code');

      expect(redis.setex).toHaveBeenCalledWith(
        `${CACHE_CONSTANTS.KEY_PREFIX}test-code`,
        CACHE_CONSTANTS.NEGATIVE_TTL_SECONDS,
        CACHE_CONSTANTS.NEGATIVE_SENTINEL,
      );
    });
  });

  describe('invalidate', () => {
    it('should delete cache entry', async () => {
      redis.del.mockResolvedValue(1);

      await service.invalidate('test-code');

      expect(redis.del).toHaveBeenCalledWith(
        `${CACHE_CONSTANTS.KEY_PREFIX}test-code`,
      );
    });
  });

  describe('invalidateAll', () => {
    it('should invalidate both shortCode and customAlias', async () => {
      redis.del.mockResolvedValue(1);

      await service.invalidateAll('test-code', 'custom-alias');

      expect(redis.del).toHaveBeenCalledTimes(2);
      expect(redis.del).toHaveBeenCalledWith(
        `${CACHE_CONSTANTS.KEY_PREFIX}test-code`,
      );
      expect(redis.del).toHaveBeenCalledWith(
        `${CACHE_CONSTANTS.KEY_PREFIX}custom-alias`,
      );
    });

    it('should only invalidate shortCode when customAlias is null', async () => {
      redis.del.mockResolvedValue(1);

      await service.invalidateAll('test-code', null);

      expect(redis.del).toHaveBeenCalledTimes(1);
    });

    it('should only invalidate shortCode when customAlias equals shortCode', async () => {
      redis.del.mockResolvedValue(1);

      await service.invalidateAll('test-code', 'test-code');

      expect(redis.del).toHaveBeenCalledTimes(1);
    });
  });
});
