import { Injectable } from '@nestjs/common';
import { Prisma, Identifier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IdentifierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdentifierCode(code: string): Promise<Identifier | null> {
    return this.prisma.identifier.findUnique({
      where: { code },
    });
  }

  async findByUrlAndOwner(
    urlId: string,
    ownerId: string,
    kind: 'GENERATED' | 'CUSTOM_ALIAS' = 'GENERATED',
  ): Promise<Identifier | null> {
    return this.prisma.identifier.findFirst({
      where: {
        urlId,
        ownerId,
        kind,
        deletedAt: null,
        disabled: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  async findAllByUrlAndOwner(
    urlId: string,
    ownerId: string,
  ): Promise<Pick<Identifier, 'id'>[]> {
    return this.prisma.identifier.findMany({
      where: {
        urlId,
        ownerId,
        deletedAt: null,
      },
      select: { id: true },
    });
  }

  async findByUrlAndGuestGenerated(urlId: string): Promise<Identifier | null> {
    return this.prisma.identifier.findFirst({
      where: {
        urlId,
        ownerId: null,
        kind: 'GENERATED',
        deletedAt: null,
        disabled: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  async existsByCode(code: string): Promise<boolean> {
    const count = await this.prisma.identifier.count({
      where: { code },
    });
    return count > 0;
  }

  async create(data: Prisma.IdentifierCreateInput): Promise<Identifier> {
    return this.prisma.identifier.create({ data });
  }

  async update(
    id: string,
    data: Prisma.IdentifierUpdateInput,
  ): Promise<Identifier> {
    return this.prisma.identifier.update({
      where: { id },
      data,
    });
  }

  async deleteByUrlId(urlId: string): Promise<void> {
    await this.prisma.identifier.deleteMany({ where: { urlId } });
  }

  async findExpiredIdentifiers(limit: number = 100): Promise<Identifier[]> {
    return this.prisma.identifier.findMany({
      where: {
        expiresAt: { lt: new Date() },
        deletedAt: null,
        disabled: false,
      },
      take: limit,
    });
  }
}
