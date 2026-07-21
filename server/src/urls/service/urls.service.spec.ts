import {
  GoneException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

import { ShortCodeGeneratorService } from '../../common/short-code/short-code-generator.service';
import {
  createConfigMock,
  createLoggerMock,
  createPrismaMock,
} from '../../testing/mocks';
import { PrismaService } from '../../prisma/prisma.service';
import { UrlsService } from './urls.service';
import { AliasValidatorService } from '../validators/alias-validator.service';

describe('UrlsService (unit)', () => {
  let service: UrlsService;
  const prisma = createPrismaMock();
  const config = createConfigMock();
  const logger = createLoggerMock();
  const shortCodeGenerator = {
    getStrategy: jest.fn().mockReturnValue('random'),
    generate: jest.fn().mockResolvedValue('abc1234'),
  };
  const aliasValidator = {
    validate: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        {
          provide: ShortCodeGeneratorService,
          useValue: shortCodeGenerator,
        },
        { provide: AliasValidatorService, useValue: aliasValidator },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(UrlsService);
  });

  describe('create', () => {
    it('creates a new short URL when none exists for the original URL and strategy', async () => {
      prisma.url.findFirst.mockResolvedValue(null);
      prisma.url.create.mockResolvedValue({
        id: 'url-1',
        originalUrl: 'https://example.com',
        shortCode: 'abc1234',
        strategy: 'random',
      });

      const result = await service.create({
        originalUrl: 'https://example.com',
      });

      expect(result).toEqual({
        originalUrl: 'https://example.com',
        shortCode: 'abc1234',
        shortUrl: 'http://localhost:3001/abc1234',
      });
      expect(prisma.url.create).toHaveBeenCalledWith({
        data: {
          originalUrl: 'https://example.com',
          shortCode: 'abc1234',
          customAlias: undefined,
          expiresAt: undefined,
          strategy: 'random',
        },
      });
    });

    it('reuses an existing URL for the same original URL and strategy', async () => {
      prisma.url.findFirst.mockResolvedValue({
        id: 'existing-1',
        originalUrl: 'https://example.com',
        shortCode: 'existing',
        strategy: 'random',
      });

      const result = await service.create({
        originalUrl: 'https://example.com',
      });

      expect(result.shortCode).toBe('existing');
      expect(prisma.url.create).not.toHaveBeenCalled();
    });

    it('validates a custom alias before creating a URL', async () => {
      prisma.url.findFirst.mockResolvedValue(null);
      prisma.url.create.mockResolvedValue({
        id: 'url-2',
        originalUrl: 'https://example.com/custom',
        shortCode: 'my-alias',
        strategy: 'random',
      });

      await service.create({
        originalUrl: 'https://example.com/custom',
        customAlias: 'My-Alias',
      });

      expect(aliasValidator.validate).toHaveBeenCalledWith('my-alias');
      expect(prisma.url.create).toHaveBeenCalledWith({
        data: {
          originalUrl: 'https://example.com/custom',
          shortCode: 'my-alias',
          customAlias: 'my-alias',
          expiresAt: undefined,
          strategy: 'random',
        },
      });
    });

    it('retries when short code generation collides', async () => {
      prisma.url.findFirst.mockResolvedValue(null);
      shortCodeGenerator.generate
        .mockResolvedValueOnce('collision')
        .mockResolvedValueOnce('unique99');

      const uniqueError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.8.0',
          meta: { target: ['shortCode'] },
        },
      );

      prisma.url.create
        .mockRejectedValueOnce(uniqueError)
        .mockResolvedValueOnce({
          id: 'url-3',
          originalUrl: 'https://example.com/retry',
          shortCode: 'unique99',
          strategy: 'random',
        });

      const result = await service.create({
        originalUrl: 'https://example.com/retry',
      });

      expect(result.shortCode).toBe('unique99');
      expect(shortCodeGenerator.generate).toHaveBeenCalledTimes(2);
    });

    it('returns existing URL when concurrent P2002 on originalUrl+strategy', async () => {
      prisma.url.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'concurrent-1',
        originalUrl: 'https://example.com/concurrent',
        shortCode: 'concur1',
        strategy: 'random',
      });

      const uniqueError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.8.0',
          meta: { target: ['originalUrl', 'strategy'] },
        },
      );

      prisma.url.create.mockRejectedValueOnce(uniqueError);

      const result = await service.create({
        originalUrl: 'https://example.com/concurrent',
      });

      expect(result.shortCode).toBe('concur1');
    });

    it('retries when P2002 on originalUrl+strategy but concurrent is null', async () => {
      prisma.url.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const uniqueError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.8.0',
          meta: { target: ['originalUrl', 'strategy'] },
        },
      );

      prisma.url.create
        .mockRejectedValueOnce(uniqueError)
        .mockResolvedValueOnce({
          id: 'url-retry2',
          originalUrl: 'https://example.com/retry2',
          shortCode: 'retry99',
          strategy: 'random',
        });

      shortCodeGenerator.generate
        .mockResolvedValueOnce('abc1234')
        .mockResolvedValueOnce('retry99');

      const result = await service.create({
        originalUrl: 'https://example.com/retry2',
      });

      expect(result.shortCode).toBe('retry99');
    });

    it('throws InternalServerErrorException for non-P2002 errors', async () => {
      prisma.url.findFirst.mockResolvedValue(null);
      prisma.url.create.mockRejectedValue(new Error('database crash'));

      await expect(
        service.create({ originalUrl: 'https://example.com/fail' }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('throws after exhausting max collision retries', async () => {
      prisma.url.findFirst.mockResolvedValue(null);

      const uniqueError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.8.0',
          meta: { target: ['shortCode'] },
        },
      );

      prisma.url.create.mockRejectedValue(uniqueError);
      shortCodeGenerator.generate.mockResolvedValue('colliding');

      await expect(
        service.create({ originalUrl: 'https://example.com/max-retry' }),
      ).rejects.toThrow('Unable to generate unique short code');
    });
  });

  describe('redirect', () => {
    it('returns the original URL for a valid short code', async () => {
      prisma.url.findFirst.mockResolvedValue({
        id: 'url-4',
        originalUrl: 'https://destination.example',
        shortCode: 'go-here',
        disabled: false,
        expiresAt: null,
      });

      await expect(service.redirect('go-here')).resolves.toBe(
        'https://destination.example',
      );
    });

    it('throws NotFoundException when the short code does not exist', async () => {
      prisma.url.findFirst.mockResolvedValue(null);

      await expect(service.redirect('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws GoneException when the URL is disabled', async () => {
      prisma.url.findFirst.mockResolvedValue({
        id: 'url-5',
        originalUrl: 'https://disabled.example',
        shortCode: 'disabled',
        disabled: true,
        expiresAt: null,
      });

      await expect(service.redirect('disabled')).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('throws GoneException when the URL is expired', async () => {
      prisma.url.findFirst.mockResolvedValue({
        id: 'url-6',
        originalUrl: 'https://expired.example',
        shortCode: 'expired',
        disabled: false,
        expiresAt: new Date('2020-01-01'),
      });

      await expect(service.redirect('expired')).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('wraps unexpected database errors as InternalServerErrorException', async () => {
      prisma.url.findFirst.mockRejectedValue(new Error('database unavailable'));

      await expect(service.redirect('broken')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
