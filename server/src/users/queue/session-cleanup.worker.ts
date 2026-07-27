import { Worker, type Job } from 'bullmq';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import {
  USER_CONSTANTS,
  USER_ERROR_MESSAGES,
} from '../constants/user.constants';
import { SessionCleanupService } from '../use-cases/session-cleanup.service';

@Injectable()
export class SessionCleanupWorker implements OnModuleInit, OnModuleDestroy {
  private readonly redisUrl: string;

  private worker!: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly cleanupService: SessionCleanupService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SessionCleanupWorker.name);
    this.redisUrl = this.config.getOrThrow<string>('REDIS_URL');
  }

  onModuleInit(): void {
    this.worker = new Worker(
      USER_CONSTANTS.SESSION_CLEANUP_QUEUE,
      async (job) => this.processJob(job),
      {
        connection: {
          url: this.redisUrl,
          maxRetriesPerRequest: null,
        },
        concurrency: USER_CONSTANTS.SESSION_CLEANUP_WORKER_CONCURRENCY,
      },
    );

    this.registerWorkerEvents();

    this.logger.info(
      {
        queue: USER_CONSTANTS.SESSION_CLEANUP_QUEUE,
        concurrency: USER_CONSTANTS.SESSION_CLEANUP_WORKER_CONCURRENCY,
      },
      'Session cleanup worker started',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(job: Job): Promise<void> {
    switch (job.name) {
      case USER_CONSTANTS.SESSION_CLEANUP_JOB_NAME:
        await this.cleanupService.cleanup();
        break;

      default:
        this.logger.warn(
          { jobName: job.name },
          'Unknown session cleanup job received',
        );
    }
  }

  private registerWorkerEvents(): void {
    this.worker.on('completed', (job) => {
      this.logger.debug({ jobId: job.id }, 'Session cleanup job completed');
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, err },
        USER_ERROR_MESSAGES.SESSION_CLEANUP_FAILED,
      );
    });

    this.worker.on('error', (err) => {
      this.logger.error({ err }, USER_ERROR_MESSAGES.SESSION_CLEANUP_FAILED);
    });
  }
}
