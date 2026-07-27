import { Injectable } from '@nestjs/common';
import { Prisma, Url } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UrlRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Url | null> {
    return this.prisma.url.findUnique({
      where: { id },
    });
  }

  create(data: Prisma.UrlCreateInput): Promise<Url> {
    return this.prisma.url.create({
      data,
    });
  }

  async findByAlias(alias: string) {
    return this.prisma.url.findFirst({
      where: {
        OR: [{ customAlias: alias }, { shortCode: alias }],
        deletedAt: null,
      },
    });
  }

  findByOriginalUrlAndStrategy(
    originalUrl: string,
    strategy: string,
  ): Promise<Url | null> {
    return this.prisma.url.findFirst({
      where: {
        originalUrl,
        strategy,
        deletedAt: null,
      },
    });
  }

  findByShortCodeOrAlias(shortCode: string): Promise<Url | null> {
    return this.prisma.url.findFirst({
      where: {
        OR: [{ shortCode }, { customAlias: shortCode }],
        deletedAt: null,
      },
    });
  }

  updateLastAccessedAt(id: string): Promise<Url> {
    return this.prisma.url.update({
      where: { id },
      data: { lastAccessedAt: new Date() },
    });
  }

  deleteExpiredUrls(): Promise<{ count: number }> {
    return this.prisma.url.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
  }
}
