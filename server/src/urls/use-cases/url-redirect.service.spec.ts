import {
  GoneException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';

import { UrlRedirectService } from './url-redirect.service';
import { UrlCacheService } from '../service/urls-cache.service';
import { UrlRepository } from '../repositories/url.repository';
import { UrlSlugRepository } from '../repositories/url-slug.repository';
import { UrlMapper } from '../mappers/urls.mapper';
import { UrlStateValidatorService } from '../validators/url-state-validator.service';
import { createLoggerMock } from '../../testing/mocks';
import { type CachedUrl } from '../../cache/types';
import { type Url } from '../types';
import { AnalyticsQueue } from '../../analytics/queue/analytics.queue';

describe('UrlRedirectService', () => {
  let service: UrlRedirectService;

  const cache = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    setNegative: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn(),
    invalidateAll: jest.fn(),
  };

  const repository = {
    findById: jest.fn(),
    create: jest.fn(),
    findByOriginalUrlAndStrategy: jest.fn(),
  };

  const slugRepository = {
    findBySlug: jest.fn(),
    existsBySlug: jest.fn(),
  };

  const mapper = {
    toResponse: jest.fn(),
    toCached: jest.fn(),
  };

  const validator = {
    validate: jest.fn(),
  };

  const logger = createLoggerMock();

  const analyticsQueue = {
    add: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mapper.toCached.mockImplementation((url: Url) => ({
      id: url.id,
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      customAlias: url.customAlias,
      disabled: url.disabled,
      expiresAt: url.expiresAt?.toISOString() ?? null,
      lastAccessedAt: new Date().toISOString(),
      deletedAt: url.deletedAt?.toISOString() ?? null,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlRedirectService,
        { provide: UrlCacheService, useValue: cache },
        { provide: UrlRepository, useValue: repository },
        { provide: UrlSlugRepository, useValue: slugRepository },
        { provide: UrlMapper, useValue: mapper },
        { provide: UrlStateValidatorService, useValue: validator },
        { provide: PinoLogger, useValue: logger },
        { provide: AnalyticsQueue, useValue: analyticsQueue },
      ],
    }).compile();

    service = module.get(UrlRedirectService);
  });

  describe('redirect', () => {
    it('returns originalUrl from cache hit', async () => {
      const cached: CachedUrl = {
        id: '1',
        originalUrl: 'https://example.com',
        shortCode: 'abc',
        customAlias: null,
        disabled: false,
        expiresAt: null,
        lastAccessedAt: null,
        deletedAt: null,
      };
      cache.get.mockResolvedValue({ status: 'hit', data: cached });

      const result = await service.redirect('abc');

      expect(result).toBe('https://example.com');
      expect(validator.validate).toHaveBeenCalledWith(cached);
      expect(slugRepository.findBySlug).not.toHaveBeenCalled();
    });

    it('returns 404 immediately on negative cache hit', async () => {
      cache.get.mockResolvedValue({ status: 'negative' });

      await expect(service.redirect('garbage')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(slugRepository.findBySlug).not.toHaveBeenCalled();
    });

    it('returns originalUrl from DB when cache misses', async () => {
      cache.get.mockResolvedValue({ status: 'miss' });
      const url: Url = {
        id: '2',
        originalUrl: 'https://other.com',
        shortCode: 'xyz',
        customAlias: null,
        disabled: false,
        expiresAt: null,
        deletedAt: null,
      };
      slugRepository.findBySlug.mockResolvedValue({ urlId: '2' });
      repository.findById.mockResolvedValue(url);

      const result = await service.redirect('xyz');

      expect(result).toBe('https://other.com');
      expect(cache.set).toHaveBeenCalledWith('xyz', expect.any(Object));
    });

    it('caches custom alias separately when it differs from shortCode', async () => {
      cache.get.mockResolvedValue({ status: 'miss' });
      const url: Url = {
        id: '3',
        originalUrl: 'https://alias.com',
        shortCode: 'gen',
        customAlias: 'my-alias',
        disabled: false,
        expiresAt: null,
        deletedAt: null,
      };
      slugRepository.findBySlug.mockResolvedValue({ urlId: '3' });
      repository.findById.mockResolvedValue(url);

      await service.redirect('gen');

      expect(cache.set).toHaveBeenCalledWith('gen', expect.any(Object));
      expect(cache.set).toHaveBeenCalledWith('my-alias', expect.any(Object));
    });

    it('throws NotFoundException when URL not found', async () => {
      cache.get.mockResolvedValue({ status: 'miss' });
      slugRepository.findBySlug.mockResolvedValue(null);

      await expect(service.redirect('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(cache.setNegative).toHaveBeenCalledWith('missing');
    });

    it('throws GoneException when URL is disabled', async () => {
      cache.get.mockResolvedValue({ status: 'miss' });
      const url: Url = {
        id: '5',
        originalUrl: 'https://disabled.com',
        shortCode: 'off',
        customAlias: null,
        disabled: true,
        expiresAt: null,
        deletedAt: null,
      };
      slugRepository.findBySlug.mockResolvedValue({ urlId: '5' });
      repository.findById.mockResolvedValue(url);
      validator.validate.mockImplementation(() => {
        throw new GoneException('URL disabled');
      });

      await expect(service.redirect('off')).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('throws GoneException when URL is expired', async () => {
      cache.get.mockResolvedValue({ status: 'miss' });
      const url: Url = {
        id: '6',
        originalUrl: 'https://expired.com',
        shortCode: 'old',
        customAlias: null,
        disabled: false,
        expiresAt: new Date('2020-01-01'),
        deletedAt: null,
      };
      slugRepository.findBySlug.mockResolvedValue({ urlId: '6' });
      repository.findById.mockResolvedValue(url);
      validator.validate.mockImplementation(() => {
        throw new GoneException('URL expired');
      });

      await expect(service.redirect('old')).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('wraps unexpected errors as InternalServerErrorException', async () => {
      cache.get.mockRejectedValue(new Error('redis down'));

      await expect(service.redirect('broken')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('re-throws NotFoundException from cache hit validation', async () => {
      const cached: CachedUrl = {
        id: '7',
        originalUrl: 'https://gone.com',
        shortCode: 'gone',
        customAlias: null,
        disabled: true,
        expiresAt: null,
        lastAccessedAt: null,
        deletedAt: null,
      };
      cache.get.mockResolvedValue({ status: 'hit', data: cached });
      validator.validate.mockImplementation(() => {
        throw new NotFoundException('not found');
      });

      await expect(service.redirect('gone')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('logs warning when analytics queue add fails', async () => {
      validator.validate.mockReset();
      const url: Url = {
        id: '9',
        originalUrl: 'https://analytics-fail.example.com',
        shortCode: 'analytics-fail',
        customAlias: null,
        disabled: false,
        expiresAt: null,
        deletedAt: null,
      };
      cache.get.mockResolvedValue({ status: 'miss' });
      slugRepository.findBySlug.mockResolvedValue({ urlId: '9' });
      repository.findById.mockResolvedValue(url);
      analyticsQueue.add.mockRejectedValue(new Error('queue full'));

      const result = await service.redirect('analytics-fail');

      expect(result).toBe('https://analytics-fail.example.com');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ shortCode: 'analytics-fail' }),
        'Failed to enqueue analytics',
      );
    });
  });
});
