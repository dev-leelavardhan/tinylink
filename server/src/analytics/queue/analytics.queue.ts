import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { ANALYTICS_CONSTANTS } from '../constants/analytics.constants';

@Injectable()
export class AnalyticsQueue extends Queue implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super(ANALYTICS_CONSTANTS.QUEUE_NAME, {
      connection: {
        url: config.getOrThrow<string>('REDIS_URL'),
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: ANALYTICS_CONSTANTS.MAX_JOB_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: ANALYTICS_CONSTANTS.BACKOFF_DELAY_MS,
        },
        removeOnComplete: {
          age: ANALYTICS_CONSTANTS.COMPLETED_JOB_MAX_AGE_SECONDS,
        },
        removeOnFail: {
          age: ANALYTICS_CONSTANTS.FAILED_JOB_MAX_AGE_SECONDS,
        },
      },
    });
  }

  async onModuleDestroy() {
    await this.close();
  }
}
