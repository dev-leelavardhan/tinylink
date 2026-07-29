import { Injectable } from '@nestjs/common';
import { type Prisma, type User, type UserStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { anonymizeIp } from '../utils/auth.utils';

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
        // Store an anonymized IP (data minimisation); analytics keeps a
        // separate salted hash for its own purposes.
        lastLoginIp: anonymizeIp(ip),
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

  updatePassword(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
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
    type?: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';
  }) {
    const { type = 'EMAIL_VERIFICATION', ...rest } = data;
    return this.prisma.verificationOtp.create({
      data: {
        ...rest,
        type,
      },
    });
  }

  findValidOtp(
    userId: string,
    type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' = 'EMAIL_VERIFICATION',
  ) {
    return this.prisma.verificationOtp.findFirst({
      where: {
        userId,
        type,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  markOtpUsed(
    userId: string,
    type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' = 'EMAIL_VERIFICATION',
  ) {
    return this.prisma.verificationOtp.updateMany({
      where: {
        userId,
        type,
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
