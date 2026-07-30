import { Worker, type Job } from 'bullmq';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import {
  ANALYTICS_CONSTANTS,
  ANALYTICS_ERROR_MESSAGES,
  ANALYTICS_LOG_MESSAGES,
} from '../constants/analytics.constants';
import { type ClickJobData } from '../types';
import { AnalyticsCleanupService } from '../use-cases/analytics-cleanup.service';
import { AnalyticsClickService } from '../use-cases/analytics-click.service';
import { shouldRunWorkers } from '../../common/service-role/service-role.util';

@Injectable()
export class AnalyticsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly redisUrl: string;

  private worker!: Worker<ClickJobData>;

  constructor(
    private readonly config: ConfigService,
    private readonly clickService: AnalyticsClickService,
    private readonly cleanupService: AnalyticsCleanupService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AnalyticsWorker.name);
    this.redisUrl = this.config.getOrThrow<string>('REDIS_URL');
  }

  onModuleInit(): void {
    if (!shouldRunWorkers(this.config)) {
      this.logger.info('Analytics worker disabled for this role (web)');
      return;
    }

    this.worker = new Worker<ClickJobData>(
      ANALYTICS_CONSTANTS.QUEUE_NAME,
      async (job) => this.processJob(job),
      {
        connection: {
          url: this.redisUrl,
          maxRetriesPerRequest: null,
        },
        concurrency: ANALYTICS_CONSTANTS.WORKER_CONCURRENCY,
      },
    );

    this.registerWorkerEvents();

    this.logger.info(
      {
        queue: ANALYTICS_CONSTANTS.QUEUE_NAME,
        concurrency: ANALYTICS_CONSTANTS.WORKER_CONCURRENCY,
      },
      'Analytics worker started',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(job: Job<ClickJobData>): Promise<void> {
    switch (job.name) {
      case ANALYTICS_CONSTANTS.JOB_CLICK:
        await this.clickService.processClick(job.data);
        break;

      case ANALYTICS_CONSTANTS.JOB_CLEANUP:
        await this.cleanupService.cleanup();
        break;

      default:
        this.logger.warn(
          { jobName: job.name },
          'Unknown analytics job received',
        );
    }
  }
  private registerWorkerEvents(): void {
    this.worker.on('completed', (job) => {
      this.logger.debug(
        {
          jobId: job.id,
          shortCode: job.data.shortCode,
        },
        ANALYTICS_LOG_MESSAGES.CLICK_PROCESSED,
      );
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        {
          jobId: job?.id,
          shortCode: job?.data?.shortCode,
          err,
        },
        ANALYTICS_ERROR_MESSAGES.CLICK_PROCESS_FAILED,
      );
    });

    this.worker.on('error', (err) => {
      this.logger.error({ err }, ANALYTICS_ERROR_MESSAGES.WORKER_ERROR);
    });
  }
}
