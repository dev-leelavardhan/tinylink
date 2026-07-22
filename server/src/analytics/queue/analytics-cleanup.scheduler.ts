import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AnalyticsQueue } from './analytics.queue';
import { ANALYTICS_CONSTANTS } from '../constants/analytics.constants';

@Injectable()
export class AnalyticsCleanupScheduler implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsCleanupScheduler.name);

  constructor(private readonly queue: AnalyticsQueue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      ANALYTICS_CONSTANTS.JOB_CLEANUP,
      {},
      {
        repeat: { pattern: ANALYTICS_CONSTANTS.CLEANUP_CRON },
        jobId: 'daily-cleanup',
      },
    );
    this.logger.log(
      { cron: ANALYTICS_CONSTANTS.CLEANUP_CRON },
      'Cleanup job scheduled',
    );
  }
}
