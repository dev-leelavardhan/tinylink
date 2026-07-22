import { Injectable } from '@nestjs/common';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { AnalyticsMapper } from '../mappers/analytics.mapper';

@Injectable()
export class AnalyticsReadService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly mapper: AnalyticsMapper,
  ) {}

  async getAggregated(urlId: string, days: number) {
    const since = new Date(Date.now() - days * 86400000);

    const [total, byBrowser, byCountry, byDevice, byDay] = await Promise.all([
      this.repository.countByFilter({ urlId, since }),
      this.repository.groupByBrowser(urlId, since),
      this.repository.groupByCountry(urlId, since),
      this.repository.groupByDevice(urlId, since),
      this.repository.groupByDay(urlId, since),
    ]);

    return this.mapper.toAggregatedResponse({
      total,
      byBrowser,
      byCountry,
      byDevice,
      byDay,
    });
  }

  async getRecentClicks(urlId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [clicks, total] = await Promise.all([
      this.repository.findRecentClicks(urlId, skip, limit),
      this.repository.countByFilter({
        urlId,
        since: new Date(0),
      }),
    ]);

    return {
      clicks: clicks.map((click) => this.mapper.toClickResponse(click)),
      total: Number(total),
      page,
      limit,
      pages: Math.ceil(Number(total) / limit),
    };
  }
}
