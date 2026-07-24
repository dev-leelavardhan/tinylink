import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { AnalyticsMapper } from '../mappers/analytics.mapper';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { ALL_TIME, daysAgo } from '../utils/helpers';

@Injectable()
export class AnalyticsReadService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly mapper: AnalyticsMapper,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AnalyticsReadService.name);
  }

  async getAggregated(urlId: string, days: number) {
    const since = daysAgo(days);

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
        since: ALL_TIME,
      }),
    ]);

    const totalClicks = Number(total);

    return {
      clicks: clicks.map((click) => this.mapper.toClickResponse(click)),
      total: totalClicks,
      page,
      limit,
      pages: Math.ceil(totalClicks / limit),
    };
  }
}
