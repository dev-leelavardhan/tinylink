import { Injectable } from '@nestjs/common';
import { type Prisma, type User, type UserStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

interface UserFilter {
  email?: string;
  status?: UserStatus;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findMany(filter: UserFilter): Promise<User[]> {
    return this.prisma.user.findMany({
      where: this.buildFilter(filter),
    });
  }

  updateLastLogin(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  updateLastLoginMetadata(
    id: string,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        lastUserAgent: userAgent,
      },
    });
  }

  incrementTokenVersion(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  updateStatus(id: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { status },
    });
  }

  incrementFailedLoginAttempts(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: { increment: 1 },
      },
    });
  }

  lockAccount(id: string, lockUntil: Date): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        status: 'LOCKED',
        lockUntil,
      },
    });
  }

  resetFailedLoginAttempts(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
        lockUntil: null,
        status: 'ACTIVE',
      },
    });
  }

  // OTP methods

  createOtp(data: {
    userId: string;
    email: string;
    otpHash: string;
    salt: string;
    expiresAt: Date;
  }) {
    return this.prisma.verificationOtp.create({
      data: {
        ...data,
        type: 'EMAIL_VERIFICATION',
      },
    });
  }

  findValidOtp(userId: string) {
    return this.prisma.verificationOtp.findFirst({
      where: {
        userId,
        type: 'EMAIL_VERIFICATION',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  markOtpUsed(userId: string) {
    return this.prisma.verificationOtp.updateMany({
      where: {
        userId,
        type: 'EMAIL_VERIFICATION',
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });
  }

  markEmailVerified(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  }

  private buildFilter(filter: UserFilter): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (filter.email) {
      where.email = filter.email;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    return where;
  }
}
