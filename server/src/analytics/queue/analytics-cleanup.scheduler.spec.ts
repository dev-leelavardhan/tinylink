import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { AnalyticsCleanupScheduler } from './analytics-cleanup.scheduler';
import { AnalyticsQueue } from './analytics.queue';
import { ANALYTICS_CONSTANTS } from '../constants/analytics.constants';

describe('AnalyticsCleanupScheduler', () => {
  let scheduler: AnalyticsCleanupScheduler;
  let queue: {
    add: jest.Mock;
  };
  let logger: {
    setContext: jest.Mock;
    info: jest.Mock;
  };

  beforeEach(async () => {
    queue = {
      add: jest.fn().mockResolvedValue({}),
    };

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsCleanupScheduler,
        { provide: AnalyticsQueue, useValue: queue },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('all') },
        },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    scheduler = module.get<AnalyticsCleanupScheduler>(
      AnalyticsCleanupScheduler,
    );
  });

  describe('onModuleInit', () => {
    it('schedules the cleanup job with cron pattern', async () => {
      await scheduler.onModuleInit();

      expect(queue.add).toHaveBeenCalledWith(
        ANALYTICS_CONSTANTS.JOB_CLEANUP,
        {},
        {
          repeat: {
            pattern: ANALYTICS_CONSTANTS.CLEANUP_CRON,
          },
          jobId: ANALYTICS_CONSTANTS.CLEANUP_JOB_ID,
        },
      );
    });

    it('logs the scheduled job', async () => {
      await scheduler.onModuleInit();

      expect(logger.info).toHaveBeenCalledWith(
        { cron: ANALYTICS_CONSTANTS.CLEANUP_CRON },
        'Cleanup job scheduled',
      );
    });
  });
});
