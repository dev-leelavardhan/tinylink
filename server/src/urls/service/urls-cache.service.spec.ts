import { Test, TestingModule } from '@nestjs/testing';
import { UrlCacheService } from './urls-cache.service';
import { CacheService } from '../../cache/service/cache.service';
import { CachedIdentifier } from '../../cache/types';
import { PinoLogger } from 'nestjs-pino';

describe('UrlCacheService', () => {
  let service: UrlCacheService;
  let cacheService: {
    get: jest.Mock;
    set: jest.Mock;
    setNegative: jest.Mock;
    invalidate: jest.Mock;
  };

  const sampleCached: CachedIdentifier = {
    id: '1',
    urlId: 'url-1',
    originalUrl: 'https://example.com',
    code: 'abc',
    kind: 'GENERATED',
    ownerId: null,
    strategy: 'RANDOM',
    disabled: false,
    expiresAt: null,
    deletedAt: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      setNegative: jest.fn(),
      invalidate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlCacheService,
        { provide: CacheService, useValue: cacheService },
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

    service = module.get(UrlCacheService);
  });

  describe('get', () => {
    it('returns parsed CachedIdentifier on cache hit', async () => {
      cacheService.get.mockResolvedValue(sampleCached);

      const result = await service.get('abc');

      expect(result).toEqual(sampleCached);
      expect(cacheService.get).toHaveBeenCalledWith('abc');
    });

    it('returns null on cache miss', async () => {
      cacheService.get.mockResolvedValue(null);

      const result = await service.get('abc');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('stores data via cache service', async () => {
      cacheService.set.mockResolvedValue(undefined);

      await service.set('abc', sampleCached);

      expect(cacheService.set).toHaveBeenCalledWith('abc', sampleCached);
    });
  });

  describe('setNegative', () => {
    it('stores negative cache via cache service', async () => {
      cacheService.setNegative.mockResolvedValue(undefined);

      await service.setNegative('abc');

      expect(cacheService.setNegative).toHaveBeenCalledWith('abc');
    });
  });

  describe('invalidate', () => {
    it('invalidates via cache service', async () => {
      cacheService.invalidate.mockResolvedValue(undefined);

      await service.invalidate('abc');

      expect(cacheService.invalidate).toHaveBeenCalledWith('abc');
    });
  });
});
