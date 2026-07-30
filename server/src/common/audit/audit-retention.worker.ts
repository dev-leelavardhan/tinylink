import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { Worker } from 'bullmq';

import { AUDIT_CONSTANTS, auditRetentionCutoff } from './audit.constants';
import { AuditService } from './audit.service';
import { shouldRunWorkers } from '../service-role/service-role.util';

@Injectable()
export class AuditRetentionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly redisUrl: string;

  private worker?: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuditRetentionWorker.name);
    this.redisUrl = this.config.getOrThrow<string>('REDIS_URL');
  }

  onModuleInit(): void {
    if (!shouldRunWorkers(this.config)) {
      return;
    }

    this.worker = new Worker(
      AUDIT_CONSTANTS.QUEUE_NAME,
      async () => this.runCleanup(),
      {
        connection: {
          url: this.redisUrl,
          maxRetriesPerRequest: null,
        },
        concurrency: AUDIT_CONSTANTS.WORKER_CONCURRENCY,
      },
    );

    this.worker.on('failed', (_job, err) => {
      this.logger.error({ err }, 'Audit retention job failed');
    });
    this.worker.on('error', (err) => {
      this.logger.error({ err }, 'Audit retention worker error');
    });

    this.logger.info(
      { queue: AUDIT_CONSTANTS.QUEUE_NAME },
      'Audit retention worker started',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async runCleanup(): Promise<void> {
    const cutoff = auditRetentionCutoff(AUDIT_CONSTANTS.DEFAULT_RETENTION_DAYS);
    const deletedCount = await this.auditService.deleteOlderThan(cutoff);
    this.logger.info(
      { deletedCount, cutoff },
      'Audit retention cleanup completed',
    );
  }
}
