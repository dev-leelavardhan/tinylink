import { Worker, Job } from 'bullmq';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsClickService } from '../use-cases/analytics-click.service';
import { AnalyticsCleanupService } from '../use-cases/analytics-cleanup.service';
import {
  ANALYTICS_CONSTANTS,
  ANALYTICS_LOG_MESSAGES,
  ANALYTICS_ERROR_MESSAGES,
} from '../constants/analytics.constants';
import { type ClickJobData } from '../analytics.interface';

@Injectable()
export class AnalyticsWorker implements OnModuleDestroy {
  private readonly worker: Worker;
  private readonly logger = new Logger(AnalyticsWorker.name);

  constructor(
    private readonly config: ConfigService,
    private readonly clickService: AnalyticsClickService,
    private readonly cleanupService: AnalyticsCleanupService,
  ) {
    this.worker = new Worker(
      ANALYTICS_CONSTANTS.QUEUE_NAME,
      async (job: Job) => {
        if (job.name === ANALYTICS_CONSTANTS.JOB_CLICK) {
          return this.processClick(job);
        }
        if (job.name === ANALYTICS_CONSTANTS.JOB_CLEANUP) {
          return this.processCleanup();
        }
      },
      {
        connection: {
          url: this.config.getOrThrow<string>('REDIS_URL'),
          maxRetriesPerRequest: null,
        },
        concurrency: ANALYTICS_CONSTANTS.WORKER_CONCURRENCY,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, shortCode: job?.data.shortCode, err },
        ANALYTICS_ERROR_MESSAGES.CLICK_PROCESS_FAILED,
      );
    });

    this.worker.on('completed', (job) => {
      this.logger.debug(
        { jobId: job.id, shortCode: job.data.shortCode },
        ANALYTICS_LOG_MESSAGES.CLICK_PROCESSED,
      );
    });

    this.worker.on('error', (err) => {
      this.logger.error({ err }, ANALYTICS_ERROR_MESSAGES.WORKER_ERROR);
    });
  }

  private async processClick(job: Job<ClickJobData>): Promise<void> {
    await this.clickService.processClick(job.data);
  }

  private async processCleanup(): Promise<void> {
    await this.cleanupService.cleanup();
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
