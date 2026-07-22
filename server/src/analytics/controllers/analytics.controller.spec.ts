import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from '../service/analytics.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: {
    getAggregated: jest.Mock;
    getRecentClicks: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getAggregated: jest.fn(),
      getRecentClicks: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: service }],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  describe('getAggregated', () => {
    it('returns aggregated analytics', async () => {
      const expected = {
        total: 100,
        byBrowser: [],
        byCountry: [],
        byDevice: [],
        byDay: [],
      };
      service.getAggregated.mockResolvedValue(expected);

      const result = await controller.getAggregated('url-id', { days: 30 });

      expect(service.getAggregated).toHaveBeenCalledWith('url-id', 30);
      expect(result).toEqual(expected);
    });
  });

  describe('getRecentClicks', () => {
    it('returns paginated clicks', async () => {
      const expected = { clicks: [], total: 0, page: 1, limit: 10, pages: 0 };
      service.getRecentClicks.mockResolvedValue(expected);

      const result = await controller.getRecentClicks('url-id', {
        page: 1,
        limit: 10,
      });

      expect(service.getRecentClicks).toHaveBeenCalledWith('url-id', 1, 10);
      expect(result).toEqual(expected);
    });
  });
});
