import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { ANALYTICS_CONSTANTS } from '../constants/analytics.constants';

@Injectable()
export class AnalyticsQueue extends Queue implements OnModuleDestroy {
  constructor(config: ConfigService) {
    const redisUrl = config.getOrThrow<string>('REDIS_URL');

    super(ANALYTICS_CONSTANTS.QUEUE_NAME, {
      connection: {
        url: redisUrl,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: ANALYTICS_CONSTANTS.MAX_JOB_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: ANALYTICS_CONSTANTS.JOB_BACKOFF_DELAY_MS,
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

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
