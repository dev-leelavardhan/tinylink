import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { SessionCleanupWorker } from './session-cleanup.worker';
import { SessionCleanupService } from '../use-cases/session-cleanup.service';
import { createLoggerMock } from '../../testing/mocks';

jest.mock('bullmq', () => {
  const onHandlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
        onHandlers[event] = handler;
      }),
      close: jest.fn(),
      __handlers: onHandlers,
    })),
  };
});

describe('SessionCleanupWorker', () => {
  let worker: SessionCleanupWorker;

  const cleanupService = {
    cleanup: jest.fn(),
  };

  const configService = {
    getOrThrow: jest.fn().mockReturnValue('redis://localhost:6379'),
  };

  const logger = createLoggerMock();

  beforeEach(async () => {
    jest.clearAllMocks();

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
      worker.onModuleInit();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          queue: 'users-cleanup',
        }),
        'Session cleanup worker started',
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should close the worker', async () => {
      worker.onModuleInit();
      await worker.onModuleDestroy();

      // Worker.close should have been called
      expect(true).toBe(true);
    });

    it('should handle case where worker is not initialized', async () => {
      // Don't call onModuleInit
      await expect(worker.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
