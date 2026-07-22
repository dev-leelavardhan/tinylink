import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { ANALYTICS_CONSTANTS } from '../constants/analytics.constants';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { daysAgo } from '../utils/helpers';

@Injectable()
export class AnalyticsCleanupService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AnalyticsCleanupService.name);
  }

  async cleanup(): Promise<void> {
    this.logger.info('Starting analytics cleanup');

    try {
      const deletedUrls = await this.repository.deleteExpiredUrls();

      this.logger.info(
        { deletedCount: deletedUrls.count },
        'Expired URLs deleted',
      );

      const retentionDate = daysAgo(ANALYTICS_CONSTANTS.DEFAULT_RETENTION_DAYS);

      const deletedAnalytics =
        await this.repository.deleteOldAnalytics(retentionDate);

      this.logger.info(
        {
          deletedCount: deletedAnalytics.count,
          retentionDate,
        },
        'Old analytics deleted',
      );

      this.logger.info('Analytics cleanup completed');
    } catch (err: unknown) {
      this.logger.error({ err }, 'Analytics cleanup failed');

      throw err;
    }
  }
}
