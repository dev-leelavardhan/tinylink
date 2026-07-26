import { Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service';

export type AuditEvent =
  | 'OTP_GENERATED'
  | 'OTP_RESENT'
  | 'OTP_VERIFIED'
  | 'OTP_EXPIRED'
  | 'OTP_FAILED'
  | 'OTP_RATE_LIMITED'
  | 'OTP_MAX_ATTEMPTS'
  | 'OTP_RESEND_COOLDOWN'
  | 'EMAIL_VERIFICATION_SUCCESS'
  | 'EMAIL_VERIFICATION_FAILED'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'SESSION_CREATED'
  | 'SESSION_REVOKED'
  | 'REFRESH_TOKEN_ISSUED';

export interface AuditLogParams {
  userId?: string;
  event: AuditEvent;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuditService.name);
  }

  async log(params: AuditLogParams): Promise<void> {
    try {
      const metadata: Prisma.InputJsonValue | undefined = params.metadata
        ? (params.metadata as Prisma.InputJsonValue)
        : undefined;

      await this.prisma.auditLog.create({
        data: {
          userId: params.userId,
          event: params.event,
          metadata,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });

      this.logger.debug(
        { event: params.event, userId: params.userId },
        'Audit log recorded',
      );
    } catch (err: unknown) {
      // Audit logging should never break the main flow
      this.logger.error(
        { err, event: params.event },
        'Failed to write audit log',
      );
    }
  }

  async logOtpGenerated(
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({ userId, event: 'OTP_GENERATED', metadata });
  }

  async logOtpResent(
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({ userId, event: 'OTP_RESENT', metadata });
  }

  async logOtpVerified(
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({ userId, event: 'OTP_VERIFIED', metadata });
  }

  async logOtpFailed(
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({ userId, event: 'OTP_FAILED', metadata });
  }

  async logOtpExpired(
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({ userId, event: 'OTP_EXPIRED', metadata });
  }

  async logOtpRateLimited(
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({ userId, event: 'OTP_RATE_LIMITED', metadata });
  }

  async logOtpMaxAttempts(
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({ userId, event: 'OTP_MAX_ATTEMPTS', metadata });
  }

  async logOtpResendCooldown(
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({ userId, event: 'OTP_RESEND_COOLDOWN', metadata });
  }

  async logEmailVerificationSuccess(
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({ userId, event: 'EMAIL_VERIFICATION_SUCCESS', metadata });
  }

  async logEmailVerificationFailed(
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({ userId, event: 'EMAIL_VERIFICATION_FAILED', metadata });
  }

  async logLoginSuccess(
    userId: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      event: 'LOGIN_SUCCESS',
      metadata,
      ipAddress,
      userAgent,
    });
  }

  async logLoginFailed(
    metadata?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      event: 'LOGIN_FAILED',
      metadata,
      ipAddress,
      userAgent,
    });
  }

  async logAccountLocked(
    userId: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      event: 'ACCOUNT_LOCKED',
      metadata,
      ipAddress,
      userAgent,
    });
  }

  async logAccountUnlocked(
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({ userId, event: 'ACCOUNT_UNLOCKED', metadata });
  }

  async logSessionCreated(
    userId: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      event: 'SESSION_CREATED',
      metadata,
      ipAddress,
      userAgent,
    });
  }

  async logSessionRevoked(
    userId: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      event: 'SESSION_REVOKED',
      metadata,
      ipAddress,
      userAgent,
    });
  }

  async logRefreshTokenIssued(
    userId: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      event: 'REFRESH_TOKEN_ISSUED',
      metadata,
      ipAddress,
      userAgent,
    });
  }
}
