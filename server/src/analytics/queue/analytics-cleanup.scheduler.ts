import { Injectable, OnModuleInit } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { ANALYTICS_CONSTANTS } from '../constants/analytics.constants';
import { AnalyticsQueue } from './analytics.queue';

@Injectable()
export class AnalyticsCleanupScheduler implements OnModuleInit {
  constructor(
    private readonly queue: AnalyticsQueue,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AnalyticsCleanupScheduler.name);
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      ANALYTICS_CONSTANTS.JOB_CLEANUP,
      {},
      {
        repeat: {
          pattern: ANALYTICS_CONSTANTS.CLEANUP_CRON,
        },
        jobId: ANALYTICS_CONSTANTS.CLEANUP_JOB_ID,
      },
    );

    this.logger.info(
      {
        cron: ANALYTICS_CONSTANTS.CLEANUP_CRON,
      },
      'Cleanup job scheduled',
    );
  }
}
