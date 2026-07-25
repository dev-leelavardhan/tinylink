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
  | 'EMAIL_VERIFICATION_FAILED';

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
}
