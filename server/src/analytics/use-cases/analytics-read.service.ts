import { ForbiddenException, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { AnalyticsMapper } from '../mappers/analytics.mapper';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { IdentifierRepository } from '../../urls/repositories/identifier.repository';
import { ALL_TIME, daysAgo } from '../utils/helpers';

@Injectable()
export class AnalyticsReadService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly identifierRepository: IdentifierRepository,
    private readonly mapper: AnalyticsMapper,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AnalyticsReadService.name);
  }

  async verifyOwnership(urlId: string, userId: string): Promise<string[]> {
    const identifier = await this.identifierRepository.findByUrlAndOwner(
      urlId,
      userId,
    );
    if (!identifier) {
      throw new ForbiddenException(
        'You do not have access to this URL analytics',
      );
    }

    // Return all identifier IDs owned by this user for this URL
    const identifiers = await this.identifierRepository.findAllByUrlAndOwner(
      urlId,
      userId,
    );
    return identifiers.map((i) => i.id);
  }

  async getAggregated(urlId: string, days: number, identifierIds?: string[]) {
    const since = daysAgo(days);

    const [total, byBrowser, byCountry, byDevice, byDay] = await Promise.all([
      this.repository.countByFilter({ urlId, since, identifierIds }),
      this.repository.groupByBrowser(urlId, since, identifierIds),
      this.repository.groupByCountry(urlId, since, identifierIds),
      this.repository.groupByDevice(urlId, since, identifierIds),
      this.repository.groupByDay(urlId, since, identifierIds),
    ]);

    return this.mapper.toAggregatedResponse({
      total,
      byBrowser,
      byCountry,
      byDevice,
      byDay,
    });
  }

  async getRecentClicks(
    urlId: string,
    page: number,
    limit: number,
    identifierIds?: string[],
  ) {
    const skip = (page - 1) * limit;

    const [clicks, total] = await Promise.all([
      this.repository.findRecentClicks(urlId, skip, limit, identifierIds),
      this.repository.countByFilter({
        urlId,
        since: ALL_TIME,
        identifierIds,
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
