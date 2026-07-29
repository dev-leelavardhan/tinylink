/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { SessionCleanupWorker } from './session-cleanup.worker';
import { SessionCleanupService } from '../use-cases/session-cleanup.service';
import {
  USER_CONSTANTS,
  USER_ERROR_MESSAGES,
} from '../constants/user.constants';

const mockOn = jest.fn();
const mockClose = jest.fn().mockResolvedValue(undefined);
let capturedProcessor:
  ((job: { name: string; id: string }) => Promise<void>) | undefined;

jest.mock('bullmq', () => ({
  Worker: jest
    .fn()
    .mockImplementation(
      (
        _name: string,
        processor: (job: { name: string; id: string }) => Promise<void>,
      ) => {
        capturedProcessor = processor;
        return {
          on: mockOn,
          close: mockClose,
        };
      },
    ),
}));

jest.mock('../../common/service-role/service-role.util', () => ({
  shouldRunWorkers: jest.fn(),
}));

describe('SessionCleanupWorker', () => {
  let worker: SessionCleanupWorker;

  const cleanupService = {
    cleanup: jest.fn(),
  };

  const configService = {
    getOrThrow: jest.fn().mockReturnValue('redis://localhost:6379'),
    get: jest.fn().mockReturnValue('all'),
  };

  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    capturedProcessor = undefined;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionCleanupWorker,
        { provide: ConfigService, useValue: configService },
        { provide: SessionCleanupService, useValue: cleanupService },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    worker = module.get(SessionCleanupWorker);
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should create a BullMQ worker', () => {
      const { shouldRunWorkers } = jest.requireMock(
        '../../common/service-role/service-role.util',
      );
      shouldRunWorkers.mockReturnValue(true);

      worker.onModuleInit();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          queue: USER_CONSTANTS.SESSION_CLEANUP_QUEUE,
        }),
        'Session cleanup worker started',
      );
    });

    it('should not start worker when role is web', () => {
      const { shouldRunWorkers } = jest.requireMock(
        '../../common/service-role/service-role.util',
      );
      shouldRunWorkers.mockReturnValue(false);

      worker.onModuleInit();

      expect(logger.info).toHaveBeenCalledWith(
        'Session cleanup worker disabled for this role (web)',
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should close the worker', async () => {
      const { shouldRunWorkers } = jest.requireMock(
        '../../common/service-role/service-role.util',
      );
      shouldRunWorkers.mockReturnValue(true);

      worker.onModuleInit();
      await worker.onModuleDestroy();

      expect(mockClose).toHaveBeenCalled();
    });

    it('should handle case where worker is not initialized', async () => {
      await expect(worker.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('processJob', () => {
    it('should call cleanup service for session cleanup job', async () => {
      const { shouldRunWorkers } = jest.requireMock(
        '../../common/service-role/service-role.util',
      );
      shouldRunWorkers.mockReturnValue(true);

      worker.onModuleInit();

      const mockJob = {
        name: USER_CONSTANTS.SESSION_CLEANUP_JOB_NAME,
        id: 'job-1',
      };
      await capturedProcessor!(mockJob);

      expect(cleanupService.cleanup).toHaveBeenCalled();
    });

    it('should log warning for unknown job name', async () => {
      const { shouldRunWorkers } = jest.requireMock(
        '../../common/service-role/service-role.util',
      );
      shouldRunWorkers.mockReturnValue(true);

      worker.onModuleInit();

      const mockJob = { name: 'unknown-job', id: 'job-2' };
      await capturedProcessor!(mockJob);

      expect(logger.warn).toHaveBeenCalledWith(
        { jobName: 'unknown-job' },
        'Unknown session cleanup job received',
      );
    });
  });

  describe('registerWorkerEvents', () => {
    it('should register event handlers', () => {
      const { shouldRunWorkers } = jest.requireMock(
        '../../common/service-role/service-role.util',
      );
      shouldRunWorkers.mockReturnValue(true);

      worker.onModuleInit();

      expect(mockOn).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle completed event', () => {
      const { shouldRunWorkers } = jest.requireMock(
        '../../common/service-role/service-role.util',
      );
      shouldRunWorkers.mockReturnValue(true);

      worker.onModuleInit();

      const completedHandler = mockOn.mock.calls.find(
        (call: unknown[]) => Array.isArray(call) && call[0] === 'completed',
      )?.[1] as ((job: { id: string }) => void) | undefined;

      if (completedHandler) {
        completedHandler({ id: 'job-1' });
        expect(logger.debug).toHaveBeenCalledWith(
          { jobId: 'job-1' },
          'Session cleanup job completed',
        );
      }
    });

    it('should handle failed event', () => {
      const { shouldRunWorkers } = jest.requireMock(
        '../../common/service-role/service-role.util',
      );
      shouldRunWorkers.mockReturnValue(true);

      worker.onModuleInit();

      const failedHandler = mockOn.mock.calls.find(
        (call: unknown[]) => Array.isArray(call) && call[0] === 'failed',
      )?.[1] as ((job: { id: string }, err: Error) => void) | undefined;

      if (failedHandler) {
        const error = new Error('Job failed');
        failedHandler({ id: 'job-1' }, error);
        expect(logger.error).toHaveBeenCalledWith(
          { jobId: 'job-1', err: error },
          USER_ERROR_MESSAGES.SESSION_CLEANUP_FAILED,
        );
      }
    });

    it('should handle error event', () => {
      const { shouldRunWorkers } = jest.requireMock(
        '../../common/service-role/service-role.util',
      );
      shouldRunWorkers.mockReturnValue(true);

      worker.onModuleInit();

      const errorHandler = mockOn.mock.calls.find(
        (call: unknown[]) => Array.isArray(call) && call[0] === 'error',
      )?.[1] as ((err: Error) => void) | undefined;

      if (errorHandler) {
        const error = new Error('Worker error');
        errorHandler(error);
        expect(logger.error).toHaveBeenCalledWith(
          { err: error },
          USER_ERROR_MESSAGES.SESSION_CLEANUP_FAILED,
        );
      }
    });
  });
});
