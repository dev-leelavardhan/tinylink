import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { USER_CONSTANTS } from '../constants/user.constants';

@Injectable()
export class SessionCleanupQueue extends Queue implements OnModuleDestroy {
  constructor(config: ConfigService) {
    const redisUrl = config.getOrThrow<string>('REDIS_URL');

    super(USER_CONSTANTS.SESSION_CLEANUP_QUEUE, {
      connection: {
        url: redisUrl,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: USER_CONSTANTS.SESSION_CLEANUP_MAX_JOB_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: USER_CONSTANTS.SESSION_CLEANUP_JOB_BACKOFF_DELAY_MS,
        },
        removeOnComplete: {
          age: USER_CONSTANTS.SESSION_CLEANUP_COMPLETED_JOB_MAX_AGE_SECONDS,
        },
        removeOnFail: {
          age: USER_CONSTANTS.SESSION_CLEANUP_FAILED_JOB_MAX_AGE_SECONDS,
        },
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
