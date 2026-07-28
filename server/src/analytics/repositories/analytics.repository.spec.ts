import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsRepository } from './analytics.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('AnalyticsRepository', () => {
  let repository: AnalyticsRepository;
  let prisma: {
    analytics: {
      create: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      analytics: {
        create: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<AnalyticsRepository>(AnalyticsRepository);
  });

  describe('create', () => {
    it('creates an analytics record', async () => {
      const data = {
        url: { connect: { id: 'url-id' } },
        browser: 'Chrome',
        os: 'Windows',
        device: 'Desktop',
        country: 'US',
        ipHash: 'hash',
        referrer: 'https://example.com',
      };
      const expected = { id: 'analytics-id', ...data };
      prisma.analytics.create.mockResolvedValue(expected);

      const result = await repository.create(data);

      expect(prisma.analytics.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(expected);
    });
  });

  describe('countByFilter', () => {
    it('counts analytics by filter', async () => {
      prisma.analytics.count.mockResolvedValue(42);

      const result = await repository.countByFilter({
        urlId: 'url-id',
        since: new Date('2024-01-01'),
      });

      expect(prisma.analytics.count).toHaveBeenCalledWith({
        where: {
          urlId: 'url-id',
          timestamp: { gte: new Date('2024-01-01') },
        },
      });
      expect(result).toBe(42);
    });
  });

  describe('groupByBrowser', () => {
    it('groups analytics by browser', async () => {
      const expected = [
        { browser: 'Chrome', _count: 10 },
        { browser: 'Firefox', _count: 5 },
      ];
      prisma.analytics.groupBy.mockResolvedValue(expected);

      const result = await repository.groupByBrowser(
        'url-id',
        new Date('2024-01-01'),
      );

      expect(prisma.analytics.groupBy).toHaveBeenCalledWith({
        by: ['browser'],
        where: {
          urlId: 'url-id',
          timestamp: { gte: new Date('2024-01-01') },
        },
        _count: true,
        orderBy: { _count: { browser: 'desc' } },
      });
      expect(result).toEqual(expected);
    });
  });

  describe('groupByCountry', () => {
    it('groups analytics by country', async () => {
      const expected = [{ country: 'US', _count: 20 }];
      prisma.analytics.groupBy.mockResolvedValue(expected);

      const result = await repository.groupByCountry(
        'url-id',
        new Date('2024-01-01'),
      );

      expect(prisma.analytics.groupBy).toHaveBeenCalledWith({
        by: ['country'],
        where: {
          urlId: 'url-id',
          timestamp: { gte: new Date('2024-01-01') },
        },
        _count: true,
        orderBy: { _count: { country: 'desc' } },
      });
      expect(result).toEqual(expected);
    });
  });

  describe('groupByDevice', () => {
    it('groups analytics by device', async () => {
      const expected = [{ device: 'Desktop', _count: 15 }];
      prisma.analytics.groupBy.mockResolvedValue(expected);

      const result = await repository.groupByDevice(
        'url-id',
        new Date('2024-01-01'),
      );

      expect(prisma.analytics.groupBy).toHaveBeenCalledWith({
        by: ['device'],
        where: {
          urlId: 'url-id',
          timestamp: { gte: new Date('2024-01-01') },
        },
        _count: true,
        orderBy: { _count: { device: 'desc' } },
      });
      expect(result).toEqual(expected);
    });
  });

  describe('groupByDay', () => {
    it('queries daily analytics', async () => {
      const expected = [
        { date: new Date('2024-01-01'), count: 10n },
        { date: new Date('2024-01-02'), count: 15n },
      ];
      prisma.$queryRaw.mockResolvedValue(expected);

      const result = await repository.groupByDay(
        'url-id',
        new Date('2024-01-01'),
      );

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe('findRecentClicks', () => {
    it('finds recent clicks with pagination', async () => {
      const expected = [
        {
          id: 'click-1',
          timestamp: new Date(),
          browser: 'Chrome',
          os: 'Windows',
          device: 'Desktop',
          country: 'US',
          referrer: null,
        },
      ];
      prisma.analytics.findMany.mockResolvedValue(expected);

      const result = await repository.findRecentClicks('url-id', 0, 10);

      expect(prisma.analytics.findMany).toHaveBeenCalledWith({
        where: { urlId: 'url-id' },
        orderBy: { timestamp: 'desc' },
        skip: 0,
        take: 10,
        select: {
          id: true,
          timestamp: true,
          browser: true,
          os: true,
          device: true,
          country: true,
          referrer: true,
        },
      });
      expect(result).toEqual(expected);
    });
  });

  describe('deleteOldAnalytics', () => {
    it('deletes old analytics records in single batch', async () => {
      prisma.$executeRaw.mockResolvedValue(50);

      const retentionDate = new Date('2024-01-01');
      const result = await repository.deleteOldAnalytics(retentionDate, 100);

      expect(typeof result).toBe('number');
      expect(result).toBe(50);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('deletes in multiple batches when more records than batch size', async () => {
      prisma.$executeRaw
        .mockResolvedValueOnce(100) // first batch full
        .mockResolvedValueOnce(50); // second batch partial

      const retentionDate = new Date('2024-01-01');
      const result = await repository.deleteOldAnalytics(retentionDate, 100);

      expect(result).toBe(150);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    });

    it('uses default batch size when not specified', async () => {
      prisma.$executeRaw.mockResolvedValue(5000);

      const retentionDate = new Date('2024-01-01');
      const result = await repository.deleteOldAnalytics(retentionDate);

      expect(result).toBe(5000);
    });
  });
});
