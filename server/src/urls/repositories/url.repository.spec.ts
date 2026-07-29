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

  describe('findById', () => {
    it('finds a URL by id', async () => {
      const url = {
        id: '1',
        originalUrl: 'https://example.com',
        normalizedUrl: 'https://example.com',
      };
      prisma.url.findUnique.mockResolvedValue(url);

      const result = await repository.findById('1');

      expect(result).toEqual(url);
      expect(prisma.url.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });

  describe('findByNormalizedUrl', () => {
    it('finds a URL by normalizedUrl', async () => {
      const url = {
        id: '1',
        originalUrl: 'https://example.com',
        normalizedUrl: 'https://example.com',
      };
      prisma.url.findUnique.mockResolvedValue(url);

      const result = await repository.findByNormalizedUrl(
        'https://example.com',
      );

      expect(result).toEqual(url);
      expect(prisma.url.findUnique).toHaveBeenCalledWith({
        where: { normalizedUrl: 'https://example.com' },
      });
    });
  });

  describe('create', () => {
    it('creates a URL record', async () => {
      const data = {
        originalUrl: 'https://example.com',
        normalizedUrl: 'https://example.com',
      };
      const expected = {
        id: '1',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.url.create.mockResolvedValue(expected);

      const result = await repository.create(data);

      expect(result).toEqual(expected);
      expect(prisma.url.create).toHaveBeenCalledWith({ data });
    });
  });

  describe('createWithIdentifier', () => {
    it('creates a URL and its identifier in a transaction', async () => {
      const urlData = {
        originalUrl: 'https://example.com',
        normalizedUrl: 'https://example.com',
      };
      const identifierData = {
        code: 'abc123',
        kind: 'GENERATED' as const,
        strategy: 'RANDOM' as const,
      };
      const expectedUrl = {
        id: '1',
        ...urlData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const expectedIdentifier = { id: '2', urlId: '1', ...identifierData };

      prisma.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          const mockTx = {
            url: { create: jest.fn().mockResolvedValue(expectedUrl) },
            identifier: {
              create: jest.fn().mockResolvedValue(expectedIdentifier),
            },
          };
          return fn(mockTx);
        },
      );

      const result = await repository.createWithIdentifier(
        urlData,
        identifierData,
      );

      expect(result.url).toEqual(expectedUrl);
      expect(result.identifier).toEqual(expectedIdentifier);
    });
  });
});
