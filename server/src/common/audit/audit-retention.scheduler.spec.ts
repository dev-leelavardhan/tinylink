/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { AuditRetentionScheduler } from './audit-retention.scheduler';
import { AuditRetentionQueue } from './audit-retention.queue';

jest.mock('../service-role/service-role.util', () => ({
  shouldRunWorkers: jest.fn(),
}));

describe('AuditRetentionScheduler', () => {
  let scheduler: AuditRetentionScheduler;
  let queue: { add: jest.Mock };
  let config: { get: jest.Mock };
  let logger: { setContext: jest.Mock; info: jest.Mock };

  beforeEach(async () => {
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue('worker') };
    logger = { setContext: jest.fn(), info: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditRetentionScheduler,
        { provide: AuditRetentionQueue, useValue: queue },
        { provide: ConfigService, useValue: config },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    scheduler = module.get(AuditRetentionScheduler);
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should not schedule when shouldRunWorkers returns false', async () => {
      const { shouldRunWorkers } = jest.requireMock(
        '../service-role/service-role.util',
      );
      shouldRunWorkers.mockReturnValue(false);

      await scheduler.onModuleInit();

      expect(queue.add).not.toHaveBeenCalled();
    });

    it('should schedule cleanup job when shouldRunWorkers returns true', async () => {
      const { shouldRunWorkers } = jest.requireMock(
        '../service-role/service-role.util',
      );
      shouldRunWorkers.mockReturnValue(true);

      await scheduler.onModuleInit();

      expect(queue.add).toHaveBeenCalledWith(
        expect.any(String),
        {},
        {
          repeat: { pattern: expect.any(String) },
          jobId: expect.any(String),
        },
      );
      expect(logger.info).toHaveBeenCalledWith(
        { cron: expect.any(String) },
        'Audit retention job scheduled',
      );
    });
  });
});
