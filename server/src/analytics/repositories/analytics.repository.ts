import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

interface AnalyticsFilter {
  urlId: string;
  since: Date;
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
      where: this.analyticsFilter(filter.urlId, filter.since),
    });
  }

  groupByBrowser(urlId: string, since: Date) {
    return this.prisma.analytics.groupBy({
      by: ['browser'],
      where: this.analyticsFilter(urlId, since),
      _count: true,
      orderBy: {
        _count: {
          browser: 'desc',
        },
      },
    });
  }

  groupByCountry(urlId: string, since: Date) {
    return this.prisma.analytics.groupBy({
      by: ['country'],
      where: this.analyticsFilter(urlId, since),
      _count: true,
      orderBy: {
        _count: {
          country: 'desc',
        },
      },
    });
  }

  groupByDevice(urlId: string, since: Date) {
    return this.prisma.analytics.groupBy({
      by: ['device'],
      where: this.analyticsFilter(urlId, since),
      _count: true,
      orderBy: {
        _count: {
          device: 'desc',
        },
      },
    });
  }

  groupByDay(urlId: string, since: Date): Promise<DailyAnalytics[]> {
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

  findRecentClicks(urlId: string, skip: number, take: number) {
    return this.prisma.analytics.findMany({
      where: {
        urlId,
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
  ): Promise<number> {
    let totalDeleted = 0;

    while (true) {
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
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return totalDeleted;
  }

  private analyticsFilter(
    urlId: string,
    since: Date,
  ): Prisma.AnalyticsWhereInput {
    return {
      urlId,
      timestamp: {
        gte: since,
      },
    };
  }
}
