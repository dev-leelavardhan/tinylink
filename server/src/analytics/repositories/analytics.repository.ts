import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

interface AnalyticsFilter {
  urlId: string;
  since: Date;
  identifierIds?: string[];
}

interface DailyAnalytics {
  date: Date;
  count: bigint;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.AnalyticsCreateInput) {
    return this.prisma.analytics.create({ data });
  }

  countByFilter(filter: AnalyticsFilter): Promise<number> {
    return this.prisma.analytics.count({
      where: this.analyticsFilter(
        filter.urlId,
        filter.since,
        filter.identifierIds,
      ),
    });
  }

  groupByBrowser(urlId: string, since: Date, identifierIds?: string[]) {
    return this.prisma.analytics.groupBy({
      by: ['browser'],
      where: this.analyticsFilter(urlId, since, identifierIds),
      _count: true,
      orderBy: {
        _count: {
          browser: 'desc',
        },
      },
    });
  }

  groupByCountry(urlId: string, since: Date, identifierIds?: string[]) {
    return this.prisma.analytics.groupBy({
      by: ['country'],
      where: this.analyticsFilter(urlId, since, identifierIds),
      _count: true,
      orderBy: {
        _count: {
          country: 'desc',
        },
      },
    });
  }

  groupByDevice(urlId: string, since: Date, identifierIds?: string[]) {
    return this.prisma.analytics.groupBy({
      by: ['device'],
      where: this.analyticsFilter(urlId, since, identifierIds),
      _count: true,
      orderBy: {
        _count: {
          device: 'desc',
        },
      },
    });
  }

  groupByDay(
    urlId: string,
    since: Date,
    identifierIds?: string[],
  ): Promise<DailyAnalytics[]> {
    if (identifierIds && identifierIds.length > 0) {
      return this.prisma.$queryRaw<DailyAnalytics[]>`
        SELECT
          DATE("timestamp") AS date,
          COUNT(*) AS count
        FROM "Analytics"
        WHERE
          "urlId" = ${urlId}
          AND "timestamp" >= ${since}
          AND "identifierId" IN (${Prisma.join(identifierIds)})
        GROUP BY DATE("timestamp")
        ORDER BY date ASC
      `;
    }
    return this.prisma.$queryRaw<DailyAnalytics[]>`
      SELECT
        DATE("timestamp") AS date,
        COUNT(*) AS count
      FROM "Analytics"
      WHERE
        "urlId" = ${urlId}
        AND "timestamp" >= ${since}
      GROUP BY DATE("timestamp")
      ORDER BY date ASC
    `;
  }

  findRecentClicks(
    urlId: string,
    skip: number,
    take: number,
    identifierIds?: string[],
  ) {
    return this.prisma.analytics.findMany({
      where: {
        urlId,
        ...(identifierIds && identifierIds.length > 0
          ? { identifierId: { in: identifierIds } }
          : {}),
      },
      orderBy: {
        timestamp: 'desc',
      },
      skip,
      take,
      select: {
        id: true,
        timestamp: true,
        browser: true,
        os: true,
        device: true,
        country: true,
        referrer: true,
      },
    });
  }

  async deleteOldAnalytics(
    retentionDate: Date,
    batchSize: number = 10000,
    maxBatches: number = 100,
  ): Promise<number> {
    let totalDeleted = 0;

    for (let batch = 0; batch < maxBatches; batch++) {
      const result = await this.prisma.$executeRaw`
        DELETE FROM "Analytics"
        WHERE "id" IN (
          SELECT "id" FROM "Analytics"
          WHERE "timestamp" < ${retentionDate}
          LIMIT ${batchSize}
        )
      `;

      totalDeleted += result;

      if (result < batchSize) break;

      // Brief pause to avoid overwhelming the database
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return totalDeleted;
  }

  private analyticsFilter(
    urlId: string,
    since: Date,
    identifierIds?: string[],
  ): Prisma.AnalyticsWhereInput {
    return {
      urlId,
      timestamp: {
        gte: since,
      },
      ...(identifierIds && identifierIds.length > 0
        ? { identifierId: { in: identifierIds } }
        : {}),
    };
  }
}
