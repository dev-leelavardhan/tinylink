import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { USER_CONSTANTS } from '../constants/user.constants';
import { shouldRunWorkers } from '../../common/service-role/service-role.util';
import { SessionCleanupQueue } from './session-cleanup.queue';

@Injectable()
export class SessionCleanupScheduler implements OnModuleInit {
  constructor(
    private readonly queue: SessionCleanupQueue,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SessionCleanupScheduler.name);
  }

  async onModuleInit(): Promise<void> {
    if (!shouldRunWorkers(this.config)) {
      return;
    }

    await this.queue.add(
      USER_CONSTANTS.SESSION_CLEANUP_JOB_NAME,
      {},
      {
        repeat: {
          pattern: USER_CONSTANTS.SESSION_CLEANUP_CRON,
        },
        jobId: USER_CONSTANTS.SESSION_CLEANUP_JOB_ID,
      },
    );

    this.logger.info(
      { cron: USER_CONSTANTS.SESSION_CLEANUP_CRON },
      'Session cleanup scheduled',
    );
  }
}
