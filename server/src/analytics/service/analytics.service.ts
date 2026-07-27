import { Injectable } from '@nestjs/common';
import { AnalyticsReadService } from '../use-cases/analytics-read.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly analyticsReadService: AnalyticsReadService) {}

  verifyOwnership(urlId: string, userId: string): Promise<void> {
    return this.analyticsReadService.verifyOwnership(urlId, userId);
  }

  getAggregated(urlId: string, days: number) {
    return this.analyticsReadService.getAggregated(urlId, days);
  }

  getRecentClicks(urlId: string, page: number, limit: number) {
    return this.analyticsReadService.getRecentClicks(urlId, page, limit);
  }
}
