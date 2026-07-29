import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { AnalyticsReadService } from '../use-cases/analytics-read.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let readService: {
    verifyOwnership: jest.Mock;
    getAggregated: jest.Mock;
    getRecentClicks: jest.Mock;
  };

  beforeEach(async () => {
    readService = {
      verifyOwnership: jest.fn().mockResolvedValue(['id-1']),
      getAggregated: jest.fn(),
      getRecentClicks: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: AnalyticsReadService, useValue: readService },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('verifyOwnership', () => {
    it('delegates to read service', async () => {
      await service.verifyOwnership('url-id', 'user-1');

      expect(readService.verifyOwnership).toHaveBeenCalledWith(
        'url-id',
        'user-1',
      );
    });
  });

  describe('getAggregated', () => {
    it('delegates to read service', async () => {
      const expected = {
        total: 100,
        byBrowser: [],
        byCountry: [],
        byDevice: [],
        byDay: [],
      };
      readService.getAggregated.mockResolvedValue(expected);

      const result = await service.getAggregated('url-id', 30);

      expect(readService.getAggregated).toHaveBeenCalledWith(
        'url-id',
        30,
        undefined,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getRecentClicks', () => {
    it('delegates to read service', async () => {
      const expected = { clicks: [], total: 0, page: 1, limit: 10, pages: 0 };
      readService.getRecentClicks.mockResolvedValue(expected);

      const result = await service.getRecentClicks('url-id', 1, 10);

      expect(readService.getRecentClicks).toHaveBeenCalledWith(
        'url-id',
        1,
        10,
        undefined,
      );
      expect(result).toEqual(expected);
    });
  });
});
