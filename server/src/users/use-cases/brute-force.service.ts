import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { USER_CONSTANTS, USER_LOG_MESSAGES } from '../constants/user.constants';
import { UserRepository } from '../repositories/user.repository';
import { RedisService } from '../../redis/service/redis.service';

@Injectable()
export class BruteForceService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly redis: RedisService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BruteForceService.name);
  }

  async checkAndRecordFailedAttempt(userId: string): Promise<void> {
    const key = `${USER_CONSTANTS.BRUTE_FORCE_KEY_PREFIX}${userId}`;
    const lockKey = `${USER_CONSTANTS.BRUTE_FORCE_LOCK_KEY_PREFIX}${userId}`;
    const lockDurationSeconds = USER_CONSTANTS.LOCK_DURATION_MINUTES * 60;

    try {
      // Fixed-window lock: if the account is already within an active lock,
      // do NOT record another failure. Otherwise a slow trickle of wrong
      // guesses would keep pushing the lock forward and turn a temporary
      // lockout into a permanent one (denial of service against the owner).
      const alreadyLocked = await this.redis.get(lockKey);
      if (alreadyLocked) {
        return;
      }

      const results = await this.redis
        .multi()
        .incr(key)
        .expire(key, lockDurationSeconds)
        .exec();
      const count = results?.[0]?.[1] as number;

      if (count >= USER_CONSTANTS.MAX_FAILED_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + lockDurationSeconds * 1000);

        await this.userRepository.lockAccount(userId, lockUntil);

        // Fixed-window lock key. It is never refreshed by later attempts
        // (see the early return above), so it always expires after
        // LOCK_DURATION_MINUTES.
        await this.redis.setex(lockKey, lockDurationSeconds, '1');

        // Clear the attempt counter so the next window starts clean once the
        // lock expires — prevents a single stray attempt from re-locking.
        await this.redis.del(key);

        this.logger.warn(
          { userId, failedAttempts: count },
          USER_LOG_MESSAGES.ACCOUNT_LOCKED,
        );
      }
    } catch (err: unknown) {
      this.logger.warn(
        { err, userId },
        'Failed to record brute force attempt in Redis — falling back to DB',
      );
      await this.recordFailedAttemptInDb(userId);
    }
  }

  /**
   * DB-backed brute-force counting used when Redis is unavailable, so account
   * lockout still triggers (fail-closed) instead of allowing unlimited guesses.
   */
  private async recordFailedAttemptInDb(userId: string): Promise<void> {
    try {
      const user =
        await this.userRepository.incrementFailedLoginAttempts(userId);

      if (
        user.failedLoginAttempts >= USER_CONSTANTS.MAX_FAILED_LOGIN_ATTEMPTS
      ) {
        const lockUntil = new Date(
          Date.now() + USER_CONSTANTS.LOCK_DURATION_MINUTES * 60 * 1000,
        );
        await this.userRepository.lockAccount(userId, lockUntil);

        this.logger.warn(
          { userId, failedAttempts: user.failedLoginAttempts },
          USER_LOG_MESSAGES.ACCOUNT_LOCKED,
        );
      }
    } catch (dbErr: unknown) {
      this.logger.error(
        { err: dbErr, userId },
        'Failed to record brute force attempt in database',
      );
    }
  }

  async isLocked(userId: string): Promise<boolean> {
    const lockKey = `${USER_CONSTANTS.BRUTE_FORCE_LOCK_KEY_PREFIX}${userId}`;

    // Try Redis first (fast path)
    try {
      const locked = await this.redis.get(lockKey);
      if (locked) {
        return true;
      }
    } catch (err: unknown) {
      this.logger.warn(
        { err, userId },
        'Redis unavailable for lock check, falling back to DB',
      );
    }

    // Fall back to database
    try {
      const user = await this.userRepository.findById(userId);
      if (user?.status === 'LOCKED' && user.lockUntil) {
        if (user.lockUntil > new Date()) {
          // Re-populate Redis lock if possible
          try {
            const ttlSeconds = Math.ceil(
              (user.lockUntil.getTime() - Date.now()) / 1000,
            );
            await this.redis.setex(lockKey, ttlSeconds, '1');
          } catch {
            // Redis unavailable — DB check is authoritative
          }
          return true;
        }

        await this.userRepository.resetFailedLoginAttempts(userId);
        return false;
      }

      return false;
    } catch (err: unknown) {
      this.logger.error(
        { err, userId },
        'Failed to check lock status in database',
      );
      // Fail-safe: if DB is also unavailable, deny access
      return true;
    }
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    try {
      const key = `${USER_CONSTANTS.BRUTE_FORCE_KEY_PREFIX}${userId}`;
      const lockKey = `${USER_CONSTANTS.BRUTE_FORCE_LOCK_KEY_PREFIX}${userId}`;

      await Promise.all([this.redis.del(key), this.redis.del(lockKey)]);

      const user = await this.userRepository.findById(userId);
      if (user?.status === 'LOCKED') {
        await this.userRepository.resetFailedLoginAttempts(userId);
      }
    } catch (err: unknown) {
      this.logger.warn(
        { err, userId },
        'Failed to reset failed attempts (Redis unavailable)',
      );
    }
  }

  async checkAccountRateLimit(email: string): Promise<boolean> {
    try {
      const key = `${USER_CONSTANTS.BRUTE_FORCE_RATE_LIMIT_KEY_PREFIX}${email}`;
      const results = await this.redis
        .multi()
        .incr(key)
        .expire(key, USER_CONSTANTS.LOGIN_RATE_LIMIT_WINDOW_SECONDS)
        .exec();
      const count = results?.[0]?.[1] as number;

      if (count > USER_CONSTANTS.LOGIN_RATE_LIMIT_PER_ACCOUNT) {
        this.logger.warn({ email }, 'Account rate limit exceeded');
        return false;
      }

      return true;
    } catch (err: unknown) {
      // Fail-closed in production (deny), fail-open otherwise (allow)
      // Fail-closed in production (deny), fail-open otherwise (allow)
      const isProduction = process.env.NODE_ENV === 'production';
      this.logger.warn(
        { err, email },
        isProduction
          ? 'Failed to check account rate limit (Redis unavailable) — denying request'
          : 'Failed to check account rate limit (Redis unavailable) — allowing request',
      );
      return !isProduction;
    }
  }
}
