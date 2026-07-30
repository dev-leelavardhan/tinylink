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
import { IdentifierRepository } from '../repositories/identifier.repository';
import { UrlMapper } from '../mappers/urls.mapper';
import { UrlStateValidatorService } from '../validators/url-state-validator.service';
import { createLoggerMock } from '../../testing/mocks';
import { type CachedIdentifier } from '../../cache/types';
import { type Identifier, type Url } from '@prisma/client';
import { AnalyticsQueue } from '../../analytics/queue/analytics.queue';

describe('UrlRedirectService', () => {
  let service: UrlRedirectService;

  const cache = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    setNegative: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn(),
  };

  const urlRepository = {
    findById: jest.fn(),
    findByNormalizedUrl: jest.fn(),
    create: jest.fn(),
    createWithIdentifier: jest.fn(),
  };

  const identifierRepository = {
    findByIdentifierCode: jest.fn(),
    findByUrlAndOwner: jest.fn(),
    findByUrlAndGuestGenerated: jest.fn(),
    existsByCode: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteByUrlId: jest.fn(),
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

  const sampleUrl: Url = {
    id: 'url-1',
    originalUrl: 'https://example.com',
    normalizedUrl: 'https://example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleIdentifier: Identifier = {
    id: 'id-1',
    code: 'abc',
    kind: 'GENERATED',
    strategy: 'RANDOM',
    urlId: 'url-1',
    ownerId: null,
    expiresAt: null,
    disabled: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    analyticsQueue.add.mockResolvedValue(undefined);
    cache.set.mockResolvedValue(undefined);
    cache.setNegative.mockResolvedValue(undefined);
    mapper.toCached.mockImplementation((url: Url, identifier: Identifier) => ({
      id: identifier.id,
      urlId: url.id,
      originalUrl: url.originalUrl,
      code: identifier.code,
      kind: identifier.kind,
      ownerId: identifier.ownerId,
      strategy: identifier.strategy,
      expiresAt: identifier.expiresAt?.toISOString() ?? null,
      disabled: identifier.disabled,
      deletedAt: identifier.deletedAt?.toISOString() ?? null,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlRedirectService,
        { provide: UrlCacheService, useValue: cache },
        { provide: UrlRepository, useValue: urlRepository },
        { provide: IdentifierRepository, useValue: identifierRepository },
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
      const cached: CachedIdentifier = {
        id: 'id-1',
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
      cache.get.mockResolvedValue({ status: 'hit', data: cached });

      const result = await service.redirect('abc');

      expect(result).toBe('https://example.com');
      expect(validator.validate).toHaveBeenCalledWith(cached);
      expect(identifierRepository.findByIdentifierCode).not.toHaveBeenCalled();
    });

    it('returns 404 immediately on negative cache hit', async () => {
      cache.get.mockResolvedValue({ status: 'negative' });

      await expect(service.redirect('garbage')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(identifierRepository.findByIdentifierCode).not.toHaveBeenCalled();
    });

    it('returns originalUrl from DB when cache misses', async () => {
      cache.get.mockResolvedValue({ status: 'miss' });
      identifierRepository.findByIdentifierCode.mockResolvedValue(
        sampleIdentifier,
      );
      urlRepository.findById.mockResolvedValue(sampleUrl);

      const result = await service.redirect('abc');

      expect(result).toBe('https://example.com');
      expect(cache.set).toHaveBeenCalledWith('abc', expect.any(Object));
    });

    it('throws NotFoundException when identifier not found', async () => {
      cache.get.mockResolvedValue({ status: 'miss' });
      identifierRepository.findByIdentifierCode.mockResolvedValue(null);

      await expect(service.redirect('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(cache.setNegative).toHaveBeenCalledWith('missing');
    });

    it('throws NotFoundException when identifier is soft deleted', async () => {
      cache.get.mockResolvedValue({ status: 'miss' });
      const deletedIdentifier = { ...sampleIdentifier, deletedAt: new Date() };
      identifierRepository.findByIdentifierCode.mockResolvedValue(
        deletedIdentifier,
      );

      await expect(service.redirect('deleted')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(cache.setNegative).toHaveBeenCalledWith('deleted');
    });

    it('throws GoneException when URL is disabled', async () => {
      cache.get.mockResolvedValue({ status: 'miss' });
      const disabledIdentifier = { ...sampleIdentifier, disabled: true };
      identifierRepository.findByIdentifierCode.mockResolvedValue(
        disabledIdentifier,
      );
      urlRepository.findById.mockResolvedValue(sampleUrl);
      validator.validate.mockImplementation(() => {
        throw new GoneException('URL disabled');
      });

      await expect(service.redirect('off')).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('throws GoneException when URL is expired', async () => {
      cache.get.mockResolvedValue({ status: 'miss' });
      const expiredIdentifier = {
        ...sampleIdentifier,
        expiresAt: new Date('2020-01-01'),
      };
      identifierRepository.findByIdentifierCode.mockResolvedValue(
        expiredIdentifier,
      );
      urlRepository.findById.mockResolvedValue(sampleUrl);
      validator.validate.mockImplementation(() => {
        throw new GoneException('URL expired');
      });

      await expect(service.redirect('old')).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('throws NotFoundException when URL record not found for identifier', async () => {
      cache.get.mockResolvedValue({ status: 'miss' });
      identifierRepository.findByIdentifierCode.mockResolvedValue(
        sampleIdentifier,
      );
      urlRepository.findById.mockResolvedValue(null);

      await expect(service.redirect('orphan')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(cache.setNegative).toHaveBeenCalledWith('orphan');
    });

    it('wraps unexpected errors as InternalServerErrorException', async () => {
      cache.get.mockRejectedValue(new Error('redis down'));

      await expect(service.redirect('broken')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('re-throws NotFoundException from cache hit validation', async () => {
      const cached: CachedIdentifier = {
        id: 'id-7',
        urlId: 'url-7',
        originalUrl: 'https://gone.com',
        code: 'gone',
        kind: 'GENERATED',
        ownerId: null,
        strategy: 'RANDOM',
        disabled: true,
        expiresAt: null,
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
      cache.get.mockResolvedValue({ status: 'miss' });
      identifierRepository.findByIdentifierCode.mockResolvedValue(
        sampleIdentifier,
      );
      urlRepository.findById.mockResolvedValue(sampleUrl);
      analyticsQueue.add.mockRejectedValue(new Error('queue full'));

      const result = await service.redirect('abc');

      expect(result).toBe('https://example.com');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'abc' }),
        'Failed to enqueue analytics',
      );
    });
  });
});
