import { Test, TestingModule } from '@nestjs/testing';
import { UrlRepository } from './url.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../testing/mocks';

describe('UrlRepository', () => {
  let repository: UrlRepository;
  const prisma = createPrismaMock();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(UrlRepository);
  });

  describe('create', () => {
    it('creates a URL record', async () => {
      const data = {
        originalUrl: 'https://example.com',
        shortCode: 'abc123',
        customAlias: null,
        expiresAt: null,
        strategy: 'random',
      };
      const expected = { id: '1', ...data };
      prisma.url.create.mockResolvedValue(expected);

      const result = await repository.create(data);

      expect(result).toEqual(expected);
      expect(prisma.url.create).toHaveBeenCalledWith({ data });
    });
  });

  describe('findByAlias', () => {
    it('finds a URL by custom alias', async () => {
      const url = { id: '1', customAlias: 'my-alias', shortCode: 'abc' };
      prisma.url.findFirst.mockResolvedValue(url);

      const result = await repository.findByAlias('my-alias');

      expect(result).toEqual(url);
      expect(prisma.url.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ customAlias: 'my-alias' }, { shortCode: 'my-alias' }],
        },
      });
    });

    it('returns null when no URL matches', async () => {
      prisma.url.findFirst.mockResolvedValue(null);

      const result = await repository.findByAlias('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByOriginalUrlAndStrategy', () => {
    it('finds a URL by originalUrl and strategy', async () => {
      const url = { id: '1', originalUrl: 'https://example.com', strategy: 'random' };
      prisma.url.findFirst.mockResolvedValue(url);

      const result = await repository.findByOriginalUrlAndStrategy(
        'https://example.com',
        'random',
      );

      expect(result).toEqual(url);
      expect(prisma.url.findFirst).toHaveBeenCalledWith({
        where: {
          originalUrl: 'https://example.com',
          strategy: 'random',
        },
      });
    });
  });

  describe('findByShortCodeOrAlias', () => {
    it('finds a URL by short code', async () => {
      const url = { id: '1', shortCode: 'abc', customAlias: null };
      prisma.url.findFirst.mockResolvedValue(url);

      const result = await repository.findByShortCodeOrAlias('abc');

      expect(result).toEqual(url);
      expect(prisma.url.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ shortCode: 'abc' }, { customAlias: 'abc' }],
        },
      });
    });
  });
});
