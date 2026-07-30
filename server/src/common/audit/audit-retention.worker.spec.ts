/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { AuditRetentionWorker } from './audit-retention.worker';
import { AuditService } from './audit.service';

const mockWorkerOn = jest.fn();
const mockWorkerClose = jest.fn().mockResolvedValue(undefined);

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: mockWorkerOn,
    close: mockWorkerClose,
  })),
}));

jest.mock('../service-role/service-role.util', () => ({
  shouldRunWorkers: jest.fn(),
}));

describe('AuditRetentionWorker', () => {
  let worker: AuditRetentionWorker;
  let auditService: { deleteOlderThan: jest.Mock };
  let config: { getOrThrow: jest.Mock };
  let logger: { setContext: jest.Mock; info: jest.Mock; error: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    auditService = { deleteOlderThan: jest.fn().mockResolvedValue(5) };
    config = {
      getOrThrow: jest.fn().mockReturnValue('redis://localhost:6379'),
    };
    logger = { setContext: jest.fn(), info: jest.fn(), error: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditRetentionWorker,
        { provide: AuditService, useValue: auditService },
        { provide: ConfigService, useValue: config },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    worker = module.get(AuditRetentionWorker);
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should not start worker when shouldRunWorkers returns false', () => {
      const { shouldRunWorkers } = jest.requireMock(
        '../service-role/service-role.util',
      );
      shouldRunWorkers.mockReturnValue(false);

      worker.onModuleInit();

      expect(logger.setContext).toHaveBeenCalledWith('AuditRetentionWorker');
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should start worker when shouldRunWorkers returns true', () => {
      const { shouldRunWorkers } = jest.requireMock(
        '../service-role/service-role.util',
      );
      shouldRunWorkers.mockReturnValue(true);

      worker.onModuleInit();

      expect(logger.info).toHaveBeenCalledWith(
        { queue: expect.any(String) },
        'Audit retention worker started',
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should close worker if it exists', async () => {
      const { shouldRunWorkers } = jest.requireMock(
        '../service-role/service-role.util',
      );
      shouldRunWorkers.mockReturnValue(true);

      worker.onModuleInit();
      await worker.onModuleDestroy();

      expect(mockWorkerClose).toHaveBeenCalled();
    });

    it('should not throw if worker is undefined', async () => {
      await expect(worker.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
