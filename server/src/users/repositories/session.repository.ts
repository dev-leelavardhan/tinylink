import { Injectable } from '@nestjs/common';
import { type Prisma, type Session } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export type SessionRefreshContext =
  | { status: 'active'; session: Session }
  | { status: 'expired'; session: Session }
  | { status: 'revoked'; session: Session }
  | { status: 'not_found' };

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

  async findSessionContextForRefresh(
    refreshTokenHash: string,
  ): Promise<SessionRefreshContext> {
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      return { status: 'not_found' };
    }

    if (session.revokedAt) {
      return { status: 'revoked', session };
    }

    if (session.expiresAt <= new Date()) {
      return { status: 'expired', session };
    }

    return { status: 'active', session };
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

  findRecentlyRevokedByUserId(userId: string, since: Date): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: { gte: since },
      },
    });
  }

  revokeAllExcept(
    userId: string,
    exceptSessionId: string,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        id: { not: exceptSessionId },
      },
      data: { revokedAt: new Date() },
    });
  }

  async rotateSession(
    oldSessionId: string,
    newSessionData: Prisma.SessionCreateInput,
  ): Promise<{ session: Session }> {
    return this.prisma.$transaction(
      async (tx) => {
        const revokedAt = new Date();

        const updatedCount: number =
          await tx.$executeRaw`UPDATE "Session" SET "revokedAt" = ${revokedAt} WHERE "id" = ${oldSessionId} AND "revokedAt" IS NULL`;

        if (updatedCount === 0) {
          throw new Error(
            'Session already revoked (concurrent refresh detected)',
          );
        }

        const session = await tx.session.create({ data: newSessionData });

        return { session };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  updateRefreshTokenHash(
    sessionId: string,
    refreshTokenHash: string,
  ): Promise<Session> {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { refreshTokenHash },
    });
  }

  deleteRevokedOlderThan(date: Date): Promise<Prisma.BatchPayload> {
    return this.prisma.session.deleteMany({
      where: {
        revokedAt: { not: null, lt: date },
      },
    });
  }
}
