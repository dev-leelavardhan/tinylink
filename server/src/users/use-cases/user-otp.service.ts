import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { createHash, randomBytes } from 'crypto';

import {
  USER_CONSTANTS,
  USER_ERROR_MESSAGES,
  USER_LOG_MESSAGES,
} from '../constants/user.constants';
import { RedisService } from '../../redis/service/redis.service';
import { UserRepository } from '../repositories/user.repository';
import { generateOtp } from '../utils/otp.utils';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class UserOtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly userRepository: UserRepository,
    private readonly auditService: AuditService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserOtpService.name);
  }

  async generate(
    userId: string,
    email: string,
    type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' = 'EMAIL_VERIFICATION',
  ): Promise<string> {
    const rawOtp = generateOtp(USER_CONSTANTS.OTP_LENGTH);
    const salt = randomBytes(16).toString('hex');
    const hashedOtp = this.hashOtp(rawOtp, salt);

    const expiresAt = new Date(
      Date.now() + USER_CONSTANTS.OTP_EXPIRY_SECONDS * 1000,
    );

    const keyPrefix =
      type === 'PASSWORD_RESET' ? 'otp:reset:' : USER_CONSTANTS.OTP_KEY_PREFIX;

    // Try Redis first (fast path), fallback to DB
    try {
      const key = `${keyPrefix}${userId}`;
      const value = JSON.stringify({
        hashedOtp,
        salt,
        email,
        expiresAt: expiresAt.toISOString(),
      });
      await this.redis.setex(key, USER_CONSTANTS.OTP_EXPIRY_SECONDS, value);
    } catch (err: unknown) {
      this.logger.warn({ err, userId }, USER_LOG_MESSAGES.OTP_STORED_IN_DB);
    }

    // Always store in DB as backup
    try {
      await this.userRepository.createOtp({
        userId,
        email,
        otpHash: hashedOtp,
        salt,
        expiresAt,
        type,
      });
    } catch (err: unknown) {
      this.logger.error({ err, userId }, 'Failed to store OTP in database');
    }

    this.logger.info({ userId, type }, USER_LOG_MESSAGES.OTP_GENERATED);
    await this.auditService.logOtpGenerated(userId);

    return rawOtp;
  }

  async verify(
    userId: string,
    otp: string,
    type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' = 'EMAIL_VERIFICATION',
  ): Promise<{ email: string } | null> {
    const keyPrefix =
      type === 'PASSWORD_RESET' ? 'otp:reset:' : USER_CONSTANTS.OTP_KEY_PREFIX;

    // Check rate limiting first
    const isRateLimited = await this.checkRateLimit(userId);
    if (isRateLimited) {
      this.logger.warn({ userId }, USER_ERROR_MESSAGES.OTP_RATE_LIMITED);
      await this.auditService.logOtpRateLimited(userId);
      return null;
    }

    // Check attempts limit
    const attemptsOk = await this.checkAttempts(userId, keyPrefix);
    if (!attemptsOk) {
      this.logger.warn({ userId }, USER_LOG_MESSAGES.OTP_MAX_ATTEMPTS_REACHED);
      await this.auditService.logOtpMaxAttempts(userId);
      return null;
    }

    // Try Redis first (fast path)
    let result = await this.verifyFromRedis(userId, otp, keyPrefix);

    // Fallback to DB if Redis fails or no result
    if (!result) {
      result = await this.verifyFromDb(userId, otp, type);
    }

    if (result) {
      // Delete from both stores on success
      await this.deleteOtp(userId, keyPrefix, type);
      await this.incrementAttempts(userId, true, keyPrefix);
      this.logger.info({ userId, type }, USER_LOG_MESSAGES.OTP_VERIFIED);
      await this.auditService.logOtpVerified(userId);
    } else {
      await this.incrementAttempts(userId, false, keyPrefix);
      await this.auditService.logOtpFailed(userId);
    }

    return result;
  }

  async resend(userId: string, email: string): Promise<string | null> {
    // Check cooldown
    const cooldownKey = `otp:cooldown:${userId}`;
    try {
      const exists = await this.redis.get(cooldownKey);
      if (exists) {
        this.logger.warn({ userId }, USER_ERROR_MESSAGES.OTP_RESEND_COOLDOWN);
        await this.auditService.logOtpResendCooldown(userId);
        return null;
      }
    } catch {
      // Redis unavailable — skip cooldown check (degrade gracefully)
    }

    // Check rate limiting
    const isRateLimited = await this.checkRateLimit(userId);
    if (isRateLimited) {
      this.logger.warn({ userId }, USER_ERROR_MESSAGES.OTP_RATE_LIMITED);
      await this.auditService.logOtpRateLimited(userId);
      return null;
    }

    // Invalidate old OTPs
    await this.invalidateOldOtps(userId);

    // Reset attempts counter (fresh OTP = fresh attempts)
    await this.resetAttempts(userId);

    // Generate new OTP
    const otp = await this.generate(userId, email);

    // Set cooldown
    try {
      await this.redis.setex(
        cooldownKey,
        USER_CONSTANTS.OTP_RESEND_COOLDOWN_SECONDS,
        '1',
      );
    } catch {
      // Redis unavailable — skip cooldown (degrade gracefully)
    }

    this.logger.info({ userId }, USER_LOG_MESSAGES.OTP_RESEND_SUCCESS);
    await this.auditService.logOtpResent(userId);

    return otp;
  }

  private async verifyFromRedis(
    userId: string,
    otp: string,
    keyPrefix: string,
  ): Promise<{ email: string } | null> {
    try {
      const key = `${keyPrefix}${userId}`;
      const raw = await this.redis.get(key);

      if (!raw) return null;

      const { hashedOtp, salt, email } = JSON.parse(raw) as {
        hashedOtp: string;
        salt: string;
        email: string;
      };

      const inputHash = this.hashOtp(otp, salt);
      if (inputHash !== hashedOtp) return null;

      return { email };
    } catch (err: unknown) {
      this.logger.warn(
        { err, userId },
        'Redis OTP lookup failed, falling back to DB',
      );
      return null;
    }
  }

  private async verifyFromDb(
    userId: string,
    otp: string,
    type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' = 'EMAIL_VERIFICATION',
  ): Promise<{ email: string } | null> {
    try {
      const otpRecord = await this.userRepository.findValidOtp(userId, type);

      if (!otpRecord) return null;

      const inputHash = this.hashOtp(otp, otpRecord.salt);
      if (otpRecord.otpHash !== inputHash) return null;

      return { email: otpRecord.email };
    } catch (err: unknown) {
      this.logger.error({ err, userId }, 'DB OTP lookup failed');
      return null;
    }
  }

  private async deleteOtp(
    userId: string,
    keyPrefix: string,
    type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' = 'EMAIL_VERIFICATION',
  ): Promise<void> {
    // Mark as used in DB FIRST (prevents reuse via Redis fallback)
    try {
      await this.userRepository.markOtpUsed(userId, type);
    } catch (err: unknown) {
      this.logger.error({ err, userId }, 'Failed to mark OTP as used in DB');
    }

    // Then delete from Redis
    try {
      const key = `${keyPrefix}${userId}`;
      await this.redis.del(key);
    } catch {
      // Redis unavailable — DB record already marked as used
    }
  }

  async invalidateOldOtps(
    userId: string,
    type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' = 'EMAIL_VERIFICATION',
  ): Promise<void> {
    const keyPrefix =
      type === 'PASSWORD_RESET' ? 'otp:reset:' : USER_CONSTANTS.OTP_KEY_PREFIX;

    // Delete from Redis
    try {
      const key = `${keyPrefix}${userId}`;
      await this.redis.del(key);
    } catch {
      // Redis unavailable — continue
    }

    // Mark old OTPs as used in DB
    try {
      await this.userRepository.markOtpUsed(userId, type);
    } catch {
      // DB unavailable — continue
    }
  }

  private async checkRateLimit(userId: string): Promise<boolean> {
    const rateLimitKey = `otp:ratelimit:${userId}`;

    try {
      const results = await this.redis
        .multi()
        .incr(rateLimitKey)
        .expire(rateLimitKey, USER_CONSTANTS.OTP_RESEND_WINDOW_SECONDS)
        .exec();
      const count = results?.[0]?.[1] as number;
      return count > USER_CONSTANTS.OTP_MAX_RESEND_PER_WINDOW;
    } catch {
      // Redis unavailable — skip rate limiting (degrade gracefully)
      return false;
    }
  }

  private async checkAttempts(
    userId: string,
    keyPrefix: string = USER_CONSTANTS.OTP_KEY_PREFIX,
  ): Promise<boolean> {
    const attemptsKey = `otp:attempts:${keyPrefix}${userId}`;

    try {
      const current = await this.redis.get(attemptsKey);
      const count = current ? parseInt(current, 10) : 0;

      return count < USER_CONSTANTS.OTP_MAX_ATTEMPTS;
    } catch {
      // Redis unavailable — allow attempt (degrade gracefully)
      return true;
    }
  }

  private async incrementAttempts(
    userId: string,
    success: boolean,
    keyPrefix: string = USER_CONSTANTS.OTP_KEY_PREFIX,
  ): Promise<void> {
    const attemptsKey = `otp:attempts:${keyPrefix}${userId}`;

    try {
      if (success) {
        // Delete attempts on success
        await this.redis.del(attemptsKey);
      } else {
        // Increment on failure with atomic TTL
        await this.redis
          .multi()
          .incr(attemptsKey)
          .expire(attemptsKey, USER_CONSTANTS.OTP_EXPIRY_SECONDS)
          .exec();
      }
    } catch {
      // Redis unavailable — skip tracking (degrade gracefully)
    }
  }

  private async resetAttempts(
    userId: string,
    keyPrefix: string = USER_CONSTANTS.OTP_KEY_PREFIX,
  ): Promise<void> {
    const attemptsKey = `otp:attempts:${keyPrefix}${userId}`;

    try {
      await this.redis.del(attemptsKey);
    } catch {
      // Redis unavailable — skip (degrade gracefully)
    }
  }

  private hashOtp(otp: string, salt: string): string {
    return createHash('sha256').update(`${otp}:${salt}`).digest('hex');
  }
}
