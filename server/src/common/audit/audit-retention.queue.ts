import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { AUDIT_CONSTANTS } from './audit.constants';

@Injectable()
export class AuditRetentionQueue extends Queue implements OnModuleDestroy {
  constructor(config: ConfigService) {
    const redisUrl = config.getOrThrow<string>('REDIS_URL');

    super(AUDIT_CONSTANTS.QUEUE_NAME, {
      connection: {
        url: redisUrl,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: AUDIT_CONSTANTS.MAX_JOB_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: AUDIT_CONSTANTS.JOB_BACKOFF_DELAY_MS,
        },
        removeOnComplete: {
          age: AUDIT_CONSTANTS.COMPLETED_JOB_MAX_AGE_SECONDS,
        },
        removeOnFail: {
          age: AUDIT_CONSTANTS.FAILED_JOB_MAX_AGE_SECONDS,
        },
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
