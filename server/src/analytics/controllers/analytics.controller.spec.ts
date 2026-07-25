import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from '../service/analytics.service';
import { UrlRepository } from '../../urls/repositories/url.repository';

type MockRequest = Request & { user: { userId: string } };

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: {
    getAggregated: jest.Mock;
    getRecentClicks: jest.Mock;
  };
  let urlRepository: {
    findById: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getAggregated: jest.fn(),
      getRecentClicks: jest.fn(),
    };
    urlRepository = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: service },
        { provide: UrlRepository, useValue: urlRepository },
      ],
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
      urlRepository.findById.mockResolvedValue({
        id: 'url-id',
        userId: 'user-1',
      });

      const mockReq = { user: { userId: 'user-1' } } as MockRequest;
      const result = await controller.getAggregated(
        'url-id',
        { days: 30 },
        mockReq,
      );

      expect(service.getAggregated).toHaveBeenCalledWith('url-id', 30);
      expect(result).toEqual(expected);
    });

    it('throws ForbiddenException if user does not own URL', async () => {
      urlRepository.findById.mockResolvedValue({
        id: 'url-id',
        userId: 'other-user',
      });

      const mockReq = { user: { userId: 'user-1' } } as MockRequest;
      await expect(
        controller.getAggregated('url-id', { days: 30 }, mockReq),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getRecentClicks', () => {
    it('returns paginated clicks', async () => {
      const expected = { clicks: [], total: 0, page: 1, limit: 10, pages: 0 };
      service.getRecentClicks.mockResolvedValue(expected);
      urlRepository.findById.mockResolvedValue({
        id: 'url-id',
        userId: 'user-1',
      });

      const mockReq = { user: { userId: 'user-1' } } as MockRequest;
      const result = await controller.getRecentClicks(
        'url-id',
        {
          page: 1,
          limit: 10,
        },
        mockReq,
      );

      expect(service.getRecentClicks).toHaveBeenCalledWith('url-id', 1, 10);
      expect(result).toEqual(expected);
    });
  });
});
