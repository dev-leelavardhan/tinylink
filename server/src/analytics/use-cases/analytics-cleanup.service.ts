import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { ANALYTICS_CONSTANTS } from '../constants/analytics.constants';

@Injectable()
export class AnalyticsCleanupService {
  private readonly logger = new Logger(AnalyticsCleanupService.name);

  constructor(private readonly repository: AnalyticsRepository) {}

  async cleanup(): Promise<void> {
    const now = new Date();

    const deletedUrls = await this.repository.deleteExpiredUrls();
    this.logger.log(
      { deletedCount: deletedUrls.count },
      'Deleted expired URLs',
    );

    const retentionDate = new Date(
      now.getTime() -
        ANALYTICS_CONSTANTS.DEFAULT_RETENTION_DAYS * 86400000,
    );
    const deletedAnalytics =
      await this.repository.deleteOldAnalytics(retentionDate);
    this.logger.log(
      { deletedCount: deletedAnalytics.count },
      'Deleted old analytics rows',
    );
  }
}
