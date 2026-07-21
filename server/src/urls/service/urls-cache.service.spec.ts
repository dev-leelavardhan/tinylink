import { Test, TestingModule } from '@nestjs/testing';
import { UrlCacheService } from './urls-cache.service';
import { RedisService } from '../../redis/redis.service';
import { createRedisMock } from '../../testing/mocks';
import { CACHE_CONSTANTS } from '../../redis/redis.constants';
import { CachedUrl } from '../../redis/redis.interface';

describe('UrlCacheService', () => {
  let service: UrlCacheService;
  const redis = createRedisMock();

  const sampleCached: CachedUrl = {
    id: '1',
    originalUrl: 'https://example.com',
    shortCode: 'abc',
    customAlias: null,
    disabled: false,
    expiresAt: null,
    lastAccessedAt: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlCacheService,
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get(UrlCacheService);
  });

  describe('get', () => {
    it('returns parsed CachedUrl on cache hit', async () => {
      redis.get.mockResolvedValue(JSON.stringify(sampleCached));

      const result = await service.get('abc');

      expect(result).toEqual(sampleCached);
      expect(redis.get).toHaveBeenCalledWith('url:abc');
    });

    it('returns null on cache miss', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.get('abc');

      expect(result).toBeNull();
    });

    it('returns null on negative cache hit', async () => {
      redis.get.mockResolvedValue(CACHE_CONSTANTS.NEGATIVE_SENTINEL);

      const result = await service.get('abc');

      expect(result).toBeNull();
    });

    it('returns null when redis throws', async () => {
      redis.get.mockRejectedValue(new Error('redis down'));

      const result = await service.get('abc');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('stores JSON-serialized CachedUrl with TTL', async () => {
      await service.set('abc', sampleCached);

      expect(redis.setex).toHaveBeenCalledWith(
        'url:abc',
        CACHE_CONSTANTS.DEFAULT_TTL_SECONDS,
        JSON.stringify(sampleCached),
      );
    });

    it('does not throw when redis fails', async () => {
      redis.setex.mockRejectedValue(new Error('redis down'));

      await expect(service.set('abc', sampleCached)).resolves.not.toThrow();
    });
  });

  describe('setNegative', () => {
    it('stores negative sentinel with negative TTL', async () => {
      await service.setNegative('abc');

      expect(redis.setex).toHaveBeenCalledWith(
        'url:abc',
        CACHE_CONSTANTS.NEGATIVE_TTL_SECONDS,
        CACHE_CONSTANTS.NEGATIVE_SENTINEL,
      );
    });

    it('does not throw when redis fails', async () => {
      redis.setex.mockRejectedValue(new Error('redis down'));

      await expect(service.setNegative('abc')).resolves.not.toThrow();
    });
  });

  describe('invalidate', () => {
    it('deletes the cache key', async () => {
      await service.invalidate('abc');

      expect(redis.del).toHaveBeenCalledWith('url:abc');
    });

    it('does not throw when redis fails', async () => {
      redis.del.mockRejectedValue(new Error('redis down'));

      await expect(service.invalidate('abc')).resolves.not.toThrow();
    });
  });

  describe('invalidateAll', () => {
    it('deletes both shortCode and customAlias when they differ', async () => {
      await service.invalidateAll('abc', 'my-alias');

      expect(redis.del).toHaveBeenCalledWith('url:abc');
      expect(redis.del).toHaveBeenCalledWith('url:my-alias');
    });

    it('only deletes shortCode when customAlias is null', async () => {
      await service.invalidateAll('abc', null);

      expect(redis.del).toHaveBeenCalledWith('url:abc');
      expect(redis.del).toHaveBeenCalledTimes(1);
    });

    it('only deletes shortCode when customAlias equals shortCode', async () => {
      await service.invalidateAll('abc', 'abc');

      expect(redis.del).toHaveBeenCalledWith('url:abc');
      expect(redis.del).toHaveBeenCalledTimes(1);
    });
  });
});
