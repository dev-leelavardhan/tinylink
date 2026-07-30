import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from '../service/analytics.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: {
    verifyOwnership: jest.Mock;
    getAggregated: jest.Mock;
    getRecentClicks: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      verifyOwnership: jest.fn().mockResolvedValue(['id-1']),
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

      const user = { userId: 'user-1' };
      const result = await controller.getAggregated(
        'url-id',
        { days: 30 },
        user,
      );

      expect(service.verifyOwnership).toHaveBeenCalledWith('url-id', 'user-1');
      expect(service.getAggregated).toHaveBeenCalledWith('url-id', 30, [
        'id-1',
      ]);
      expect(result).toEqual(expected);
    });

    it('throws ForbiddenException if user does not own URL', async () => {
      service.verifyOwnership.mockRejectedValue(
        new ForbiddenException('You do not have access to this URL analytics'),
      );

      const user = { userId: 'user-1' };
      await expect(
        controller.getAggregated('url-id', { days: 30 }, user),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getRecentClicks', () => {
    it('returns paginated clicks', async () => {
      const expected = { clicks: [], total: 0, page: 1, limit: 10, pages: 0 };
      service.getRecentClicks.mockResolvedValue(expected);

      const user = { userId: 'user-1' };
      const result = await controller.getRecentClicks(
        'url-id',
        {
          page: 1,
          limit: 10,
        },
        user,
      );

      expect(service.verifyOwnership).toHaveBeenCalledWith('url-id', 'user-1');
      expect(service.getRecentClicks).toHaveBeenCalledWith('url-id', 1, 10, [
        'id-1',
      ]);
      expect(result).toEqual(expected);
    });
  });
});
