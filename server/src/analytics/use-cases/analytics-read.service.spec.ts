import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsReadService } from './analytics-read.service';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { UrlRepository } from '../../urls/repositories/url.repository';
import { AnalyticsMapper } from '../mappers/analytics.mapper';
import { PinoLogger } from 'nestjs-pino';

describe('AnalyticsReadService', () => {
  let service: AnalyticsReadService;
  let repository: {
    countByFilter: jest.Mock;
    groupByBrowser: jest.Mock;
    groupByCountry: jest.Mock;
    groupByDevice: jest.Mock;
    groupByDay: jest.Mock;
    findRecentClicks: jest.Mock;
  };
  let urlRepository: {
    findById: jest.Mock;
  };
  let mapper: {
    toAggregatedResponse: jest.Mock;
    toClickResponse: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      countByFilter: jest.fn(),
      groupByBrowser: jest.fn(),
      groupByCountry: jest.fn(),
      groupByDevice: jest.fn(),
      groupByDay: jest.fn(),
      findRecentClicks: jest.fn(),
    };

    urlRepository = {
      findById: jest.fn(),
    };

    mapper = {
      toAggregatedResponse: jest.fn(),
      toClickResponse: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsReadService,
        { provide: AnalyticsRepository, useValue: repository },
        { provide: UrlRepository, useValue: urlRepository },
        { provide: AnalyticsMapper, useValue: mapper },
        {
          provide: PinoLogger,
          useValue: { setContext: jest.fn(), info: jest.fn(), warn: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AnalyticsReadService>(AnalyticsReadService);
  });

  describe('getAggregated', () => {
    it('fetches and maps aggregated data', async () => {
      const urlId = 'url-id';
      const days = 30;

      repository.countByFilter.mockResolvedValue(100);
      repository.groupByBrowser.mockResolvedValue([
        { browser: 'Chrome', _count: 60 },
      ]);
      repository.groupByCountry.mockResolvedValue([
        { country: 'US', _count: 70 },
      ]);
      repository.groupByDevice.mockResolvedValue([
        { device: 'Desktop', _count: 80 },
      ]);
      repository.groupByDay.mockResolvedValue([
        { date: new Date(), count: 100 },
      ]);

      const expectedResponse = {
        total: 100,
        byBrowser: [{ browser: 'Chrome', count: 60 }],
        byCountry: [{ country: 'US', count: 70 }],
        byDevice: [{ device: 'Desktop', count: 80 }],
        byDay: [{ date: new Date(), count: 100 }],
      };
      mapper.toAggregatedResponse.mockReturnValue(expectedResponse);

      const result = await service.getAggregated(urlId, days);

      expect(repository.countByFilter).toHaveBeenCalledWith({
        urlId,
        since: expect.any(Date) as Date,
      });
      expect(repository.groupByBrowser).toHaveBeenCalledWith(
        urlId,
        expect.any(Date) as Date,
      );
      expect(repository.groupByCountry).toHaveBeenCalledWith(
        urlId,
        expect.any(Date) as Date,
      );
      expect(repository.groupByDevice).toHaveBeenCalledWith(
        urlId,
        expect.any(Date) as Date,
      );
      expect(repository.groupByDay).toHaveBeenCalledWith(
        urlId,
        expect.any(Date) as Date,
      );
      expect(mapper.toAggregatedResponse).toHaveBeenCalled();
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getRecentClicks', () => {
    it('fetches paginated clicks', async () => {
      const urlId = 'url-id';
      const page = 2;
      const limit = 10;

      const mockClicks = [
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
      repository.findRecentClicks.mockResolvedValue(mockClicks);
      repository.countByFilter.mockResolvedValue(25);

      const mappedClick = {
        id: 'click-1',
        timestamp: new Date(),
        browser: 'Chrome',
        os: 'Windows',
        device: 'Desktop',
        country: 'US',
        referrer: null,
      };
      mapper.toClickResponse.mockReturnValue(mappedClick);

      const result = await service.getRecentClicks(urlId, page, limit);

      expect(repository.findRecentClicks).toHaveBeenCalledWith(urlId, 10, 10);
      expect(repository.countByFilter).toHaveBeenCalledWith({
        urlId,
        since: expect.any(Date) as Date,
      });
      expect(result).toEqual({
        clicks: [mappedClick],
        total: 25,
        page: 2,
        limit: 10,
        pages: 3,
      });
    });

    it('calculates correct page count', async () => {
      repository.findRecentClicks.mockResolvedValue([]);
      repository.countByFilter.mockResolvedValue(0);
      mapper.toClickResponse.mockReturnValue(null);

      const result = await service.getRecentClicks('url-id', 1, 50);

      expect(result.pages).toBe(0);
    });

    it('handles first page correctly', async () => {
      repository.findRecentClicks.mockResolvedValue([]);
      repository.countByFilter.mockResolvedValue(100);

      await service.getRecentClicks('url-id', 1, 10);

      expect(repository.findRecentClicks).toHaveBeenCalledWith('url-id', 0, 10);
    });
  });
});
