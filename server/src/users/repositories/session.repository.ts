import { Injectable } from '@nestjs/common';
import { type Prisma, type Session } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.SessionCreateInput): Promise<Session> {
    return this.prisma.session.create({ data });
  }

  findById(id: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { id } });
  }

  findByRefreshTokenHash(refreshTokenHash: string): Promise<Session | null> {
    return this.prisma.session.findFirst({
      where: {
        refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  findActiveByUserId(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  updateLastUsed(id: string): Promise<Session> {
    return this.prisma.session.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  revoke(id: string): Promise<Session> {
    return this.prisma.session.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllForUser(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  deleteExpired(): Promise<Prisma.BatchPayload> {
    return this.prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }

  countActiveForUser(userId: string): Promise<number> {
    return this.prisma.session.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }
}
