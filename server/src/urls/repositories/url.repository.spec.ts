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
      providers: [UrlRepository, { provide: PrismaService, useValue: prisma }],
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

  describe('createWithSlugs', () => {
    it('creates a URL and its slugs in a transaction', async () => {
      const urlData = {
        originalUrl: 'https://example.com',
        shortCode: 'abc123',
        customAlias: null,
        expiresAt: null,
        strategy: 'random',
      };
      const slugs = [{ slug: 'abc123' }];
      const expectedUrl = { id: '1', ...urlData };

      const mockTx = {
        url: { create: jest.fn().mockResolvedValue(expectedUrl) },
        urlSlug: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };

      prisma.$transaction.mockImplementation((fn: (arg: unknown) => unknown) =>
        fn(mockTx),
      );

      const result = await repository.createWithSlugs(urlData, slugs);

      expect(result).toEqual(expectedUrl);
      expect(mockTx.url.create).toHaveBeenCalledWith({ data: urlData });
      expect(mockTx.urlSlug.createMany).toHaveBeenCalledWith({
        data: [{ slug: 'abc123', urlId: '1' }],
      });
    });
  });

  describe('findByOriginalUrlAndStrategy', () => {
    it('finds a URL by originalUrl and strategy', async () => {
      const url = {
        id: '1',
        originalUrl: 'https://example.com',
        strategy: 'random',
      };
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
          deletedAt: null,
        },
      });
    });
  });
});
