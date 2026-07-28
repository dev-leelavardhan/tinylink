import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';

import { SessionCleanupScheduler } from './session-cleanup.scheduler';
import { SessionCleanupQueue } from './session-cleanup.queue';
import { USER_CONSTANTS } from '../constants/user.constants';
import { createLoggerMock } from '../../testing/mocks';

describe('SessionCleanupScheduler', () => {
  let scheduler: SessionCleanupScheduler;

  const queue = {
    add: jest.fn().mockResolvedValue({}),
  };

  const logger = createLoggerMock();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionCleanupScheduler,
        { provide: SessionCleanupQueue, useValue: queue },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    scheduler = module.get(SessionCleanupScheduler);
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should schedule the cleanup job with cron pattern', async () => {
      await scheduler.onModuleInit();

      expect(queue.add).toHaveBeenCalledWith(
        USER_CONSTANTS.SESSION_CLEANUP_JOB_NAME,
        {},
        {
          repeat: {
            pattern: USER_CONSTANTS.SESSION_CLEANUP_CRON,
          },
          jobId: USER_CONSTANTS.SESSION_CLEANUP_JOB_ID,
        },
      );
    });

    it('should log the scheduled job', async () => {
      await scheduler.onModuleInit();

      expect(logger.info).toHaveBeenCalledWith(
        { cron: USER_CONSTANTS.SESSION_CLEANUP_CRON },
        'Session cleanup scheduled',
      );
    });
  });
});
