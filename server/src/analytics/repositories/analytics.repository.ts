import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.AnalyticsCreateInput) {
    return this.prisma.analytics.create({ data });
  }

  updateLastAccessedAt(urlId: string) {
    return this.prisma.url.update({
      where: { id: urlId },
      data: { lastAccessedAt: new Date() },
    });
  }

  async countByFilter(filter: {
    urlId: string;
    since: Date;
  }): Promise<number> {
    return this.prisma.analytics.count({
      where: { urlId: filter.urlId, timestamp: { gte: filter.since } },
    });
  }

  async groupByBrowser(urlId: string, since: Date) {
    return this.prisma.analytics.groupBy({
      by: ['browser'],
      where: { urlId, timestamp: { gte: since } },
      _count: true,
      orderBy: { _count: { browser: 'desc' } },
    });
  }

  async groupByCountry(urlId: string, since: Date) {
    return this.prisma.analytics.groupBy({
      by: ['country'],
      where: { urlId, timestamp: { gte: since } },
      _count: true,
      orderBy: { _count: { country: 'desc' } },
    });
  }

  async groupByDevice(urlId: string, since: Date) {
    return this.prisma.analytics.groupBy({
      by: ['device'],
      where: { urlId, timestamp: { gte: since } },
      _count: true,
      orderBy: { _count: { device: 'desc' } },
    });
  }

  async groupByDay(urlId: string, since: Date) {
    return this.prisma.$queryRaw`
      SELECT DATE("timestamp") as date, COUNT(*) as count
      FROM "Analytics"
      WHERE "urlId" = ${urlId} AND "timestamp" >= ${since}
      GROUP BY DATE("timestamp")
      ORDER BY date ASC
    `;
  }

  async findRecentClicks(urlId: string, skip: number, take: number) {
    return this.prisma.analytics.findMany({
      where: { urlId },
      orderBy: { timestamp: 'desc' },
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

  async deleteExpiredUrls() {
    return this.prisma.url.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  async deleteOldAnalytics(retentionDate: Date) {
    return this.prisma.analytics.deleteMany({
      where: { timestamp: { lt: retentionDate } },
    });
  }
}
