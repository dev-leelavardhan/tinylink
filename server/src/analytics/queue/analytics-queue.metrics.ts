import { Injectable, OnModuleInit } from '@nestjs/common';

import { MetricsService } from '../../metrics/metrics.service';
import { ANALYTICS_CONSTANTS } from '../constants/analytics.constants';
import { AnalyticsQueue } from './analytics.queue';

/**
 * Exposes BullMQ analytics queue depth as a Prometheus gauge, refreshed on each
 * scrape. Lets operators alert on a growing backlog (e.g. worker outage).
 */
@Injectable()
export class AnalyticsQueueMetrics implements OnModuleInit {
  constructor(
    private readonly queue: AnalyticsQueue,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    this.metrics.createCollectedGauge(
      {
        name: 'bullmq_queue_jobs',
        help: 'Number of BullMQ jobs by state',
        labelNames: ['queue', 'state'],
      },
      async (gauge) => {
        const counts = await this.queue.getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
        );
        for (const [state, value] of Object.entries(counts)) {
          gauge.set(
            { queue: ANALYTICS_CONSTANTS.QUEUE_NAME, state },
            value ?? 0,
          );
        }
      },
    );
  }
}
