import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { AnalyticsCleanupService } from './analytics-cleanup.service';
import { AnalyticsRepository } from '../repositories/analytics.repository';

describe('AnalyticsCleanupService', () => {
  let service: AnalyticsCleanupService;
  let repository: {
    deleteExpiredUrls: jest.Mock;
    deleteOldAnalytics: jest.Mock;
  };
  let logger: {
    setContext: jest.Mock;
    info: jest.Mock;
    error: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      deleteExpiredUrls: jest.fn().mockResolvedValue({ count: 5 }),
      deleteOldAnalytics: jest.fn().mockResolvedValue({ count: 100 }),
    };

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsCleanupService,
        { provide: AnalyticsRepository, useValue: repository },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get<AnalyticsCleanupService>(AnalyticsCleanupService);
  });

  describe('cleanup', () => {
    it('deletes expired URLs and old analytics', async () => {
      await service.cleanup();

      expect(repository.deleteExpiredUrls).toHaveBeenCalled();
      expect(repository.deleteOldAnalytics).toHaveBeenCalledWith(
        expect.any(Date),
      );
    });

    it('logs success messages', async () => {
      await service.cleanup();

      expect(logger.info).toHaveBeenCalledWith('Starting analytics cleanup');
      expect(logger.info).toHaveBeenCalledWith(
        { deletedCount: 5 },
        'Expired URLs deleted',
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ deletedCount: 100 }),
        'Old analytics deleted',
      );
      expect(logger.info).toHaveBeenCalledWith('Analytics cleanup completed');
    });

    it('logs and throws on error', async () => {
      const error = new Error('Database error');
      repository.deleteExpiredUrls.mockRejectedValue(error);

      await expect(service.cleanup()).rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        { err: error },
        'Analytics cleanup failed',
      );
    });

    it('computes correct retention date', async () => {
      await service.cleanup();

      const retentionDate = repository.deleteOldAnalytics.mock.calls[0][0];
      const expectedRetention = new Date(
        Date.now() - 90 * 24 * 60 * 60 * 1000,
      );

      expect(retentionDate.getTime()).toBeCloseTo(
        expectedRetention.getTime(),
        -3,
      );
    });
  });
});
