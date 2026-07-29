import { Injectable } from '@nestjs/common';
import { AnalyticsReadService } from '../use-cases/analytics-read.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly analyticsReadService: AnalyticsReadService) {}

  verifyOwnership(urlId: string, userId: string): Promise<string[]> {
    return this.analyticsReadService.verifyOwnership(urlId, userId);
  }

  getAggregated(urlId: string, days: number, identifierIds?: string[]) {
    return this.analyticsReadService.getAggregated(urlId, days, identifierIds);
  }

  getRecentClicks(
    urlId: string,
    page: number,
    limit: number,
    identifierIds?: string[],
  ) {
    return this.analyticsReadService.getRecentClicks(
      urlId,
      page,
      limit,
      identifierIds,
    );
  }
}
