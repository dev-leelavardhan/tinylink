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

  findByNormalizedUrl(normalizedUrl: string): Promise<Url | null> {
    return this.prisma.url.findUnique({
      where: { normalizedUrl },
    });
  }

  async create(data: Prisma.UrlCreateInput): Promise<Url> {
    return this.prisma.url.create({ data });
  }

  async createWithIdentifier(
    urlData: Prisma.UrlCreateInput,
    identifierData: Omit<Prisma.IdentifierCreateInput, 'url'>,
  ): Promise<{ url: Url; identifier: unknown }> {
    return this.prisma.$transaction(async (tx) => {
      const url = await tx.url.create({ data: urlData });
      const identifier = await tx.identifier.create({
        data: {
          ...identifierData,
          url: { connect: { id: url.id } },
        },
      });
      return { url, identifier };
    });
  }
}
