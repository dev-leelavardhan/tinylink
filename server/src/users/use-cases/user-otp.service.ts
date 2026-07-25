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

@Injectable()
export class UserOtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly userRepository: UserRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserOtpService.name);
  }

  async generate(userId: string, email: string): Promise<string> {
    const rawOtp = generateOtp(USER_CONSTANTS.OTP_LENGTH);
    const salt = randomBytes(16).toString('hex');
    const hashedOtp = this.hashOtp(rawOtp, salt);

    const expiresAt = new Date(
      Date.now() + USER_CONSTANTS.OTP_EXPIRY_SECONDS * 1000,
    );

    // Try Redis first (fast path), fallback to DB
    try {
      const key = `${USER_CONSTANTS.OTP_KEY_PREFIX}${userId}`;
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
      });
    } catch (err: unknown) {
      this.logger.error({ err, userId }, 'Failed to store OTP in database');
    }

    this.logger.info({ userId }, USER_LOG_MESSAGES.OTP_GENERATED);

    return rawOtp;
  }

  async verify(userId: string, otp: string): Promise<{ email: string } | null> {
    // Check rate limiting first
    const isRateLimited = await this.checkRateLimit(userId);
    if (isRateLimited) {
      this.logger.warn({ userId }, USER_ERROR_MESSAGES.OTP_RATE_LIMITED);
      return null;
    }

    // Check attempts limit
    const attemptsOk = await this.checkAttempts(userId);
    if (!attemptsOk) {
      this.logger.warn({ userId }, USER_LOG_MESSAGES.OTP_MAX_ATTEMPTS_REACHED);
      return null;
    }

    // Try Redis first (fast path)
    let result = await this.verifyFromRedis(userId, otp);

    // Fallback to DB if Redis fails or no result
    if (!result) {
      result = await this.verifyFromDb(userId, otp);
    }

    if (result) {
      // Delete from both stores on success
      await this.deleteOtp(userId);
      await this.incrementAttempts(userId, true);
      this.logger.info({ userId }, USER_LOG_MESSAGES.OTP_VERIFIED);
    } else {
      await this.incrementAttempts(userId, false);
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
        return null;
      }
    } catch {
      // Redis unavailable — skip cooldown check (degrade gracefully)
    }

    // Check rate limiting
    const isRateLimited = await this.checkRateLimit(userId);
    if (isRateLimited) {
      this.logger.warn({ userId }, USER_ERROR_MESSAGES.OTP_RATE_LIMITED);
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

    return otp;
  }

  private async verifyFromRedis(
    userId: string,
    otp: string,
  ): Promise<{ email: string } | null> {
    try {
      const key = `${USER_CONSTANTS.OTP_KEY_PREFIX}${userId}`;
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
  ): Promise<{ email: string } | null> {
    try {
      const otpRecord = await this.userRepository.findValidOtp(userId);

      if (!otpRecord) return null;

      const inputHash = this.hashOtp(otp, otpRecord.salt);
      if (otpRecord.otpHash !== inputHash) return null;

      return { email: otpRecord.email };
    } catch (err: unknown) {
      this.logger.error({ err, userId }, 'DB OTP lookup failed');
      return null;
    }
  }

  private async deleteOtp(userId: string): Promise<void> {
    // Mark as used in DB FIRST (prevents reuse via Redis fallback)
    try {
      await this.userRepository.markOtpUsed(userId);
    } catch (err: unknown) {
      this.logger.error({ err, userId }, 'Failed to mark OTP as used in DB');
    }

    // Then delete from Redis
    try {
      const key = `${USER_CONSTANTS.OTP_KEY_PREFIX}${userId}`;
      await this.redis.del(key);
    } catch {
      // Redis unavailable — DB record already marked as used
    }
  }

  private async invalidateOldOtps(userId: string): Promise<void> {
    // Delete from Redis
    try {
      const key = `${USER_CONSTANTS.OTP_KEY_PREFIX}${userId}`;
      await this.redis.del(key);
    } catch {
      // Redis unavailable — continue
    }

    // Mark old OTPs as used in DB
    try {
      await this.userRepository.markOtpUsed(userId);
    } catch {
      // DB unavailable — continue
    }
  }

  private async checkRateLimit(userId: string): Promise<boolean> {
    const rateLimitKey = `otp:ratelimit:${userId}`;

    try {
      const count = await this.redis.incr(rateLimitKey);
      if (count === 1) {
        await this.redis.expire(
          rateLimitKey,
          USER_CONSTANTS.OTP_RESEND_WINDOW_SECONDS,
        );
      }
      return count > USER_CONSTANTS.OTP_MAX_RESEND_PER_WINDOW;
    } catch {
      // Redis unavailable — skip rate limiting (degrade gracefully)
      return false;
    }
  }

  private async checkAttempts(userId: string): Promise<boolean> {
    const attemptsKey = `otp:attempts:${userId}`;

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
  ): Promise<void> {
    const attemptsKey = `otp:attempts:${userId}`;

    try {
      if (success) {
        // Delete attempts on success
        await this.redis.del(attemptsKey);
      } else {
        // Increment on failure (atomic)
        const count = await this.redis.incr(attemptsKey);
        if (count === 1) {
          await this.redis.expire(
            attemptsKey,
            USER_CONSTANTS.OTP_EXPIRY_SECONDS,
          );
        }
      }
    } catch {
      // Redis unavailable — skip tracking (degrade gracefully)
    }
  }

  private async resetAttempts(userId: string): Promise<void> {
    const attemptsKey = `otp:attempts:${userId}`;

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
