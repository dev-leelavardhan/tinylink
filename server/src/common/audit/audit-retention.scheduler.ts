import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { AUDIT_CONSTANTS } from './audit.constants';
import { AuditRetentionQueue } from './audit-retention.queue';
import { shouldRunWorkers } from '../service-role/service-role.util';

@Injectable()
export class AuditRetentionScheduler implements OnModuleInit {
  constructor(
    private readonly queue: AuditRetentionQueue,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuditRetentionScheduler.name);
  }

  async onModuleInit(): Promise<void> {
    if (!shouldRunWorkers(this.config)) {
      return;
    }

    await this.queue.add(
      AUDIT_CONSTANTS.JOB_CLEANUP,
      {},
      {
        repeat: {
          pattern: AUDIT_CONSTANTS.CLEANUP_CRON,
        },
        jobId: AUDIT_CONSTANTS.CLEANUP_JOB_ID,
      },
    );

    this.logger.info(
      { cron: AUDIT_CONSTANTS.CLEANUP_CRON },
      'Audit retention job scheduled',
    );
  }
}
