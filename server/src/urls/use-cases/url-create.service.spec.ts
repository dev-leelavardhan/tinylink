import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { UrlCreateService } from './url-create.service';
import { ShortCodeGeneratorService } from '../../common/short-code/short-code-generator.service';
import { UrlCacheService } from '../service/urls-cache.service';
import { AliasValidatorService } from '../validators/alias-validator.service';
import { UrlRepository } from '../repositories/url.repository';
import { UrlMapper } from '../mappers/urls.mapper';
import { createLoggerMock } from '../../testing/mocks';
import { PinoLogger } from 'nestjs-pino';
import { CreateUrlDto } from '../dto/create-url.dto';
import { Url } from '../urls.interface';

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
    invalidateAll: jest.fn(),
  };

  const repository = {
    create: jest.fn(),
    findByAlias: jest.fn(),
    findByOriginalUrlAndStrategy: jest.fn(),
    findByShortCodeOrAlias: jest.fn(),
  };

  const mapper = {
    toResponse: jest.fn(),
    toCached: jest.fn(),
  };

  const logger = createLoggerMock();

  beforeEach(async () => {
    jest.clearAllMocks();
    shortCodeGenerator.getStrategy.mockReturnValue('random');
    shortCodeGenerator.generate.mockResolvedValue('gen123');
    aliasValidator.validate.mockResolvedValue('validated-alias');
    mapper.toResponse.mockImplementation((url: Url) => ({
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      shortUrl: `http://localhost:3000/${url.shortCode}`,
    }));
    mapper.toCached.mockImplementation((url: Url) => ({
      id: url.id,
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      customAlias: url.customAlias,
      disabled: url.disabled,
      expiresAt: url.expiresAt?.toISOString() ?? null,
      lastAccessedAt: new Date().toISOString(),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlCreateService,
        { provide: ShortCodeGeneratorService, useValue: shortCodeGenerator },
        { provide: AliasValidatorService, useValue: aliasValidator },
        { provide: UrlCacheService, useValue: cache },
        { provide: UrlRepository, useValue: repository },
        { provide: UrlMapper, useValue: mapper },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(UrlCreateService);
  });

  describe('create', () => {
    const dto: CreateUrlDto = { originalUrl: 'https://example.com' };

    it('returns existing URL when one already exists for the same originalUrl+strategy', async () => {
      const existing = {
        id: 'existing',
        originalUrl: 'https://example.com',
        shortCode: 'existing',
      };
      repository.findByOriginalUrlAndStrategy.mockResolvedValue(existing);

      const result = await service.create(dto);

      expect(result).toEqual(mapper.toResponse(existing));
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('creates a new URL with generated short code', async () => {
      repository.findByOriginalUrlAndStrategy.mockResolvedValue(null);
      const created = {
        id: '1',
        originalUrl: 'https://example.com',
        shortCode: 'gen123',
        strategy: 'random',
        disabled: false,
        expiresAt: null,
        customAlias: null,
      };
      repository.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith({
        originalUrl: 'https://example.com',
        shortCode: 'gen123',
        customAlias: undefined,
        expiresAt: undefined,
        strategy: 'random',
      });
      expect(cache.set).toHaveBeenCalledWith('gen123', expect.any(Object));
      expect(result).toEqual(mapper.toResponse(created));
    });

    it('validates custom alias when provided', async () => {
      const aliasDto: CreateUrlDto = {
        originalUrl: 'https://example.com',
        customAlias: 'My-Alias',
      };
      repository.findByOriginalUrlAndStrategy.mockResolvedValue(null);
      const created = {
        id: '2',
        originalUrl: 'https://example.com',
        shortCode: 'validated-alias',
        strategy: 'random',
        disabled: false,
        expiresAt: null,
        customAlias: 'validated-alias',
      };
      repository.create.mockResolvedValue(created);

      await service.create(aliasDto);

      expect(aliasValidator.validate).toHaveBeenCalledWith('My-Alias');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          shortCode: 'validated-alias',
          customAlias: 'validated-alias',
        }),
      );
    });

    it('retries on P2002 shortCode collision', async () => {
      repository.findByOriginalUrlAndStrategy.mockResolvedValue(null);
      shortCodeGenerator.generate
        .mockResolvedValueOnce('collision')
        .mockResolvedValueOnce('unique');

      const collisionError = new PrismaClientKnownRequestError('collision', {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { target: ['shortCode'] },
      });

      const created = {
        id: '3',
        originalUrl: 'https://example.com',
        shortCode: 'unique',
        strategy: 'random',
        disabled: false,
        expiresAt: null,
        customAlias: null,
      };
      repository.create
        .mockRejectedValueOnce(collisionError)
        .mockResolvedValueOnce(created);

      const result = await service.create(dto);

      expect(shortCodeGenerator.generate).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mapper.toResponse(created));
    });

    it('returns concurrent URL on P2002 originalUrl+strategy collision', async () => {
      repository.findByOriginalUrlAndStrategy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'concurrent',
          originalUrl: 'https://example.com',
          shortCode: 'con1',
        });

      const collisionError = new PrismaClientKnownRequestError('collision', {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { target: ['originalUrl', 'strategy'] },
      });

      repository.create.mockRejectedValueOnce(collisionError);

      const result = await service.create(dto);

      expect(result).toEqual(
        mapper.toResponse({
          id: 'concurrent',
          originalUrl: 'https://example.com',
          shortCode: 'con1',
        }),
      );
    });

    it('retries when concurrent lookup returns null after P2002 originalUrl+strategy', async () => {
      repository.findByOriginalUrlAndStrategy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const collisionError = new PrismaClientKnownRequestError('collision', {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { target: ['originalUrl', 'strategy'] },
      });

      shortCodeGenerator.generate
        .mockResolvedValueOnce('abc1234')
        .mockResolvedValueOnce('retry99');

      const created = {
        id: '4',
        originalUrl: 'https://example.com',
        shortCode: 'retry99',
        strategy: 'random',
        disabled: false,
        expiresAt: null,
        customAlias: null,
      };
      repository.create
        .mockRejectedValueOnce(collisionError)
        .mockResolvedValueOnce(created);

      const result = await service.create(dto);

      expect(result).toEqual(mapper.toResponse(created));
    });

    it('throws InternalServerErrorException for non-P2002 errors', async () => {
      repository.findByOriginalUrlAndStrategy.mockResolvedValue(null);
      repository.create.mockRejectedValue(new Error('db crash'));

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('throws after exhausting max retries', async () => {
      repository.findByOriginalUrlAndStrategy.mockResolvedValue(null);

      const collisionError = new PrismaClientKnownRequestError('collision', {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { target: ['shortCode'] },
      });

      repository.create.mockRejectedValue(collisionError);
      shortCodeGenerator.generate.mockResolvedValue('colliding');

      await expect(service.create(dto)).rejects.toThrow(
        'Unable to generate unique short code',
      );
    });
  });
});
