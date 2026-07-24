import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { AnalyticsWorker } from './analytics.worker';
import { AnalyticsClickService } from '../use-cases/analytics-click.service';
import { AnalyticsCleanupService } from '../use-cases/analytics-cleanup.service';
import { ANALYTICS_CONSTANTS } from '../constants/analytics.constants';
import {
  ANALYTICS_ERROR_MESSAGES,
  ANALYTICS_LOG_MESSAGES,
} from '../constants/analytics.constants';

const mockOn = jest.fn();
const mockClose = jest.fn().mockResolvedValue(undefined);
let processJobCallback:
  ((job: { name: string; data: unknown }) => Promise<void>) | null = null;

jest.mock('bullmq', () => {
  const mockWorker = jest
    .fn()
    .mockImplementation(
      (
        queueName: string,
        callback: (job: { name: string; data: unknown }) => Promise<void>,
      ) => {
        processJobCallback = callback;
        return {
          on: mockOn,
          close: mockClose,
        };
      },
    );
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
    jest.clearAllMocks();
    processJobCallback = null;

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

    it('registers worker events', () => {
      worker.onModuleInit();

      expect(mockOn).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('propagates error when REDIS_URL is not configured', async () => {
      const badConfig = {
        getOrThrow: jest.fn().mockImplementation(() => {
          throw new Error('Missing key: REDIS_URL');
        }),
      };

      await expect(
        Test.createTestingModule({
          providers: [
            AnalyticsWorker,
            { provide: AnalyticsClickService, useValue: clickService },
            { provide: AnalyticsCleanupService, useValue: cleanupService },
            { provide: ConfigService, useValue: badConfig },
            { provide: PinoLogger, useValue: logger },
          ],
        })
          .compile()
          .then((m) => {
            const w = m.get(AnalyticsWorker);
            w.onModuleInit();
          }),
      ).rejects.toThrow('Missing key: REDIS_URL');
    });
  });

  describe('onModuleDestroy', () => {
    it('closes the worker', async () => {
      worker.onModuleInit();
      await worker.onModuleDestroy();

      expect(mockClose).toHaveBeenCalled();
    });

    it('handles missing worker gracefully', async () => {
      await worker.onModuleDestroy();

      expect(mockClose).not.toHaveBeenCalled();
    });
  });

  describe('processJob', () => {
    it('processes click job', async () => {
      worker.onModuleInit();

      const job = {
        name: ANALYTICS_CONSTANTS.JOB_CLICK,
        data: { shortCode: 'test' },
      };

      await processJobCallback!(job);

      expect(clickService.processClick).toHaveBeenCalledWith(job.data);
    });

    it('processes cleanup job', async () => {
      worker.onModuleInit();

      const job = {
        name: ANALYTICS_CONSTANTS.JOB_CLEANUP,
        data: { shortCode: 'test' },
      };

      await processJobCallback!(job);

      expect(cleanupService.cleanup).toHaveBeenCalled();
    });

    it('handles unknown job type', async () => {
      worker.onModuleInit();

      const job = {
        name: 'unknown-job',
        data: { shortCode: 'test' },
      };

      await processJobCallback!(job);

      expect(logger.warn).toHaveBeenCalledWith(
        { jobName: 'unknown-job' },
        'Unknown analytics job received',
      );
    });
  });

  describe('worker events', () => {
    it('logs on completed event', () => {
      worker.onModuleInit();

      const completedHandler = (
        mockOn.mock.calls.find(
          (call: unknown[]) => call[0] === 'completed',
        ) as unknown[]
      )?.[1] as
        | ((job: { id: string; data: { shortCode: string } }) => void)
        | undefined;

      const job = {
        id: '123',
        data: { shortCode: 'test-code' },
      };

      if (completedHandler) {
        completedHandler(job);
      }

      expect(logger.debug).toHaveBeenCalledWith(
        { jobId: '123', shortCode: 'test-code' },
        ANALYTICS_LOG_MESSAGES.CLICK_PROCESSED,
      );
    });

    it('logs on failed event', () => {
      worker.onModuleInit();

      const failedHandler = (
        mockOn.mock.calls.find(
          (call: unknown[]) => call[0] === 'failed',
        ) as unknown[]
      )?.[1] as ((job: unknown, err: Error) => void) | undefined;

      const job = {
        id: '123',
        data: { shortCode: 'test-code' },
      };
      const error = new Error('test error');

      if (failedHandler) {
        failedHandler(job, error);
      }

      expect(logger.error).toHaveBeenCalledWith(
        { jobId: '123', shortCode: 'test-code', err: error },
        ANALYTICS_ERROR_MESSAGES.CLICK_PROCESS_FAILED,
      );
    });

    it('logs on failed event with null job', () => {
      worker.onModuleInit();

      const failedHandler = (
        mockOn.mock.calls.find(
          (call: unknown[]) => call[0] === 'failed',
        ) as unknown[]
      )?.[1] as ((job: unknown, err: Error) => void) | undefined;

      const error = new Error('test error');

      if (failedHandler) {
        failedHandler(null, error);
      }

      expect(logger.error).toHaveBeenCalledWith(
        { jobId: undefined, shortCode: undefined, err: error },
        ANALYTICS_ERROR_MESSAGES.CLICK_PROCESS_FAILED,
      );
    });

    it('logs on error event', () => {
      worker.onModuleInit();

      const errorHandler = (
        mockOn.mock.calls.find(
          (call: unknown[]) => call[0] === 'error',
        ) as unknown[]
      )?.[1] as ((err: Error) => void) | undefined;

      const error = new Error('worker error');

      if (errorHandler) {
        errorHandler(error);
      }

      expect(logger.error).toHaveBeenCalledWith(
        { err: error },
        ANALYTICS_ERROR_MESSAGES.WORKER_ERROR,
      );
    });
  });
});
