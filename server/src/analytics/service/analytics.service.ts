import { Injectable } from '@nestjs/common';
import { AnalyticsReadService } from '../use-cases/analytics-read.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly reader: AnalyticsReadService) {}

  getAggregated(urlId: string, days: number) {
    return this.reader.getAggregated(urlId, days);
  }

  getRecentClicks(urlId: string, page: number, limit: number) {
    return this.reader.getRecentClicks(urlId, page, limit);
  }
}
