import { Test, TestingModule } from '@nestjs/testing';

import { UrlSlugRepository } from './url-slug.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('UrlSlugRepository', () => {
  let repo: UrlSlugRepository;

  const prisma = {
    urlSlug: {
      findUnique: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlSlugRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repo = module.get(UrlSlugRepository);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('findBySlug', () => {
    it('should return urlId when slug exists', async () => {
      prisma.urlSlug.findUnique.mockResolvedValue({ urlId: 'url-1' });

      const result = await repo.findBySlug('abc123');

      expect(result).toEqual({ urlId: 'url-1' });
      expect(prisma.urlSlug.findUnique).toHaveBeenCalledWith({
        where: { slug: 'abc123' },
        select: { urlId: true },
      });
    });

    it('should return null when slug does not exist', async () => {
      prisma.urlSlug.findUnique.mockResolvedValue(null);

      const result = await repo.findBySlug('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('existsBySlug', () => {
    it('should return true when slug exists', async () => {
      prisma.urlSlug.count.mockResolvedValue(1);

      const result = await repo.existsBySlug('abc123');

      expect(result).toBe(true);
    });

    it('should return false when slug does not exist', async () => {
      prisma.urlSlug.count.mockResolvedValue(0);

      const result = await repo.existsBySlug('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('createMany', () => {
    it('should create multiple slugs', async () => {
      prisma.urlSlug.createMany.mockResolvedValue({ count: 2 });

      await repo.createMany([
        { slug: 'abc', urlId: 'url-1' },
        { slug: 'def', urlId: 'url-1' },
      ]);

      expect(prisma.urlSlug.createMany).toHaveBeenCalledWith({
        data: [
          { slug: 'abc', urlId: 'url-1' },
          { slug: 'def', urlId: 'url-1' },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe('deleteByUrlId', () => {
    it('should delete all slugs for a url', async () => {
      prisma.urlSlug.deleteMany.mockResolvedValue({ count: 2 });

      await repo.deleteByUrlId('url-1');

      expect(prisma.urlSlug.deleteMany).toHaveBeenCalledWith({
        where: { urlId: 'url-1' },
      });
    });
  });
});
