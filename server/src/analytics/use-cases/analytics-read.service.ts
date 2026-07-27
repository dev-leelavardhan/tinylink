import { ForbiddenException, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { AnalyticsMapper } from '../mappers/analytics.mapper';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { UrlRepository } from '../../urls/repositories/url.repository';
import { ALL_TIME, daysAgo } from '../utils/helpers';

@Injectable()
export class AnalyticsReadService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly urlRepository: UrlRepository,
    private readonly mapper: AnalyticsMapper,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AnalyticsReadService.name);
  }

  async verifyOwnership(urlId: string, userId: string): Promise<void> {
    const url = await this.urlRepository.findById(urlId);
    if (!url) {
      throw new ForbiddenException('URL not found');
    }
    if (url.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this URL analytics',
      );
    }
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
      clicks,
      total: totalClicks,
      page,
      limit,
      pages: Math.ceil(totalClicks / limit),
    };
  }
}
