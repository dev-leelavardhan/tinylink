import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PinoLogger } from 'nestjs-pino';

import { UrlCreateService } from './url-create.service';
import { ShortCodeGeneratorService } from '../../common/short-code/short-code-generator.service';
import { UrlCacheService } from '../service/urls-cache.service';
import { AliasValidatorService } from '../validators/alias-validator.service';
import { UrlRepository } from '../repositories/url.repository';
import { IdentifierRepository } from '../repositories/identifier.repository';
import { UrlMapper } from '../mappers/urls.mapper';
import { RedisService } from '../../redis/service/redis.service';
import { createLoggerMock } from '../../testing/mocks';
import { CreateUrlDto } from '../dto/create-url.dto';
import { type Identifier, type Url } from '@prisma/client';

describe('UrlCreateService', () => {
  let service: UrlCreateService;

  const shortCodeGenerator = {
    getStrategy: jest.fn().mockReturnValue('random'),
    generate: jest.fn().mockResolvedValue('gen123'),
  };

  const aliasValidator = {
    validate: jest.fn().mockResolvedValue('validated-alias'),
  };

  const cache = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    setNegative: jest.fn(),
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

  const redis = {
    multi: jest.fn(),
  };

  const logger = createLoggerMock();

  const sampleUrl: Url = {
    id: 'url-1',
    originalUrl: 'https://example.com',
    normalizedUrl: 'https://example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleIdentifier: Identifier = {
    id: 'id-1',
    code: 'gen123',
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
    jest.clearAllMocks();
    shortCodeGenerator.getStrategy.mockReturnValue('random');
    shortCodeGenerator.generate.mockResolvedValue('gen123');
    aliasValidator.validate.mockResolvedValue('validated-alias');
    mapper.toResponse.mockImplementation(
      (url: Url, identifier: Identifier) => ({
        id: identifier.id,
        originalUrl: url.originalUrl,
        shortCode: identifier.code,
        shortUrl: `http://localhost:3000/${identifier.code}`,
      }),
    );
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

    const mockMulti = {
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([[null, 1]]),
    };
    redis.multi.mockReturnValue(mockMulti);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlCreateService,
        { provide: ShortCodeGeneratorService, useValue: shortCodeGenerator },
        { provide: AliasValidatorService, useValue: aliasValidator },
        { provide: UrlCacheService, useValue: cache },
        { provide: UrlRepository, useValue: urlRepository },
        { provide: IdentifierRepository, useValue: identifierRepository },
        { provide: UrlMapper, useValue: mapper },
        { provide: RedisService, useValue: redis },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(UrlCreateService);
  });

  describe('create', () => {
    const dto: CreateUrlDto = { originalUrl: 'https://example.com' };

    it('returns existing identifier when one already exists for the same URL+owner', async () => {
      urlRepository.findByNormalizedUrl.mockResolvedValue(sampleUrl);
      identifierRepository.findByUrlAndGuestGenerated.mockResolvedValue(
        sampleIdentifier,
      );

      const result = await service.create(dto);

      expect(result).toEqual(mapper.toResponse(sampleUrl, sampleIdentifier));
      expect(identifierRepository.create).not.toHaveBeenCalled();
    });

    it('creates a new URL and identifier with generated short code', async () => {
      urlRepository.findByNormalizedUrl.mockResolvedValue(sampleUrl);
      identifierRepository.findByUrlAndGuestGenerated.mockResolvedValue(null);
      identifierRepository.create.mockResolvedValue(sampleIdentifier);

      const result = await service.create(dto);

      expect(urlRepository.create).not.toHaveBeenCalled();
      expect(identifierRepository.create).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalledWith('gen123', expect.any(Object));
      expect(result).toEqual(mapper.toResponse(sampleUrl, sampleIdentifier));
    });

    it('creates URL record when normalizedUrl not found', async () => {
      urlRepository.findByNormalizedUrl.mockResolvedValue(null);
      urlRepository.create.mockResolvedValue(sampleUrl);
      identifierRepository.create.mockResolvedValue(sampleIdentifier);

      await service.create(dto);

      expect(urlRepository.create).toHaveBeenCalledWith({
        originalUrl: 'https://example.com',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        normalizedUrl: expect.any(String),
      });
    });

    it('validates custom alias when provided', async () => {
      const aliasDto: CreateUrlDto = {
        originalUrl: 'https://example.com',
        customAlias: 'My-Alias',
      };
      urlRepository.findByNormalizedUrl.mockResolvedValue(sampleUrl);
      const aliasIdentifier = {
        ...sampleIdentifier,
        code: 'validated-alias',
        kind: 'CUSTOM_ALIAS' as const,
      };
      identifierRepository.create.mockResolvedValue(aliasIdentifier);

      await service.create(aliasDto);

      expect(aliasValidator.validate).toHaveBeenCalledWith('My-Alias');
      expect(identifierRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'validated-alias',
          kind: 'CUSTOM_ALIAS',
        }),
      );
    });

    it('retries on P2002 code collision', async () => {
      urlRepository.findByNormalizedUrl.mockResolvedValue(sampleUrl);
      identifierRepository.findByUrlAndGuestGenerated.mockResolvedValue(null);
      shortCodeGenerator.generate
        .mockResolvedValueOnce('collision')
        .mockResolvedValueOnce('unique');

      const collisionError = new PrismaClientKnownRequestError('collision', {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { target: ['code'] },
      });

      const uniqueIdentifier = { ...sampleIdentifier, code: 'unique' };
      identifierRepository.create
        .mockRejectedValueOnce(collisionError)
        .mockResolvedValueOnce(uniqueIdentifier);

      const result = await service.create(dto);

      expect(shortCodeGenerator.generate).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mapper.toResponse(sampleUrl, uniqueIdentifier));
    });

    it('throws ConflictException on P2002 for custom alias collision', async () => {
      const aliasDto: CreateUrlDto = {
        originalUrl: 'https://example.com',
        customAlias: 'taken-alias',
      };
      urlRepository.findByNormalizedUrl.mockResolvedValue(sampleUrl);
      aliasValidator.validate.mockResolvedValue('taken-alias');

      const collisionError = new PrismaClientKnownRequestError('collision', {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { target: ['code'] },
      });
      identifierRepository.create.mockRejectedValue(collisionError);

      await expect(service.create(aliasDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws InternalServerErrorException for non-P2002 errors', async () => {
      urlRepository.findByNormalizedUrl.mockResolvedValue(sampleUrl);
      identifierRepository.findByUrlAndGuestGenerated.mockResolvedValue(null);
      identifierRepository.create.mockRejectedValue(new Error('db crash'));

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('throws after exhausting max retries', async () => {
      urlRepository.findByNormalizedUrl.mockResolvedValue(sampleUrl);
      identifierRepository.findByUrlAndGuestGenerated.mockResolvedValue(null);

      const collisionError = new PrismaClientKnownRequestError('collision', {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { target: ['code'] },
      });

      identifierRepository.create.mockRejectedValue(collisionError);
      shortCodeGenerator.generate.mockResolvedValue('colliding');

      await expect(service.create(dto)).rejects.toThrow(
        'Unable to generate unique short code',
      );
    });
  });
});
