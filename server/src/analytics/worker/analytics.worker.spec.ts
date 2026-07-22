import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { AnalyticsWorker } from './analytics.worker';
import { AnalyticsClickService } from '../use-cases/analytics-click.service';
import { AnalyticsCleanupService } from '../use-cases/analytics-cleanup.service';
import { ANALYTICS_CONSTANTS } from '../constants/analytics.constants';

jest.mock('bullmq', () => {
  const mockWorker = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  }));
  return { Worker: mockWorker };
});

describe('AnalyticsWorker', () => {
  let worker: AnalyticsWorker;
  let clickService: {
    processClick: jest.Mock;
  };
  let cleanupService: {
    cleanup: jest.Mock;
  };
  let config: {
    getOrThrow: jest.Mock;
  };
  let logger: {
    setContext: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    debug: jest.Mock;
  };

  beforeEach(async () => {
    clickService = {
      processClick: jest.fn().mockResolvedValue(undefined),
    };

    cleanupService = {
      cleanup: jest.fn().mockResolvedValue(undefined),
    };

    config = {
      getOrThrow: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsWorker,
        { provide: AnalyticsClickService, useValue: clickService },
        { provide: AnalyticsCleanupService, useValue: cleanupService },
        { provide: ConfigService, useValue: config },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    worker = module.get<AnalyticsWorker>(AnalyticsWorker);
  });

  describe('onModuleInit', () => {
    it('creates the worker with correct config', () => {
      worker.onModuleInit();

      expect(config.getOrThrow).toHaveBeenCalledWith('REDIS_URL');
      expect(logger.info).toHaveBeenCalledWith(
        {
          queue: ANALYTICS_CONSTANTS.QUEUE_NAME,
          concurrency: ANALYTICS_CONSTANTS.WORKER_CONCURRENCY,
        },
        'Analytics worker started',
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('closes the worker', async () => {
      worker.onModuleInit();
      await worker.onModuleDestroy();

      // The worker.close() is called on the mocked worker
    });
  });
});
