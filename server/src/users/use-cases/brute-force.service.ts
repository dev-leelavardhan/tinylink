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
    try {
      const key = `${USER_CONSTANTS.BRUTE_FORCE_KEY_PREFIX}${userId}`;
      const count = await this.redis.incr(key);

      if (count === 1) {
        const lockDurationSeconds = USER_CONSTANTS.LOCK_DURATION_MINUTES * 60;
        await this.redis.expire(key, lockDurationSeconds);
      }

      if (count >= USER_CONSTANTS.MAX_FAILED_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(
          Date.now() + USER_CONSTANTS.LOCK_DURATION_MINUTES * 60 * 1000,
        );

        await this.userRepository.lockAccount(userId, lockUntil);

        const lockKey = `${USER_CONSTANTS.BRUTE_FORCE_LOCK_KEY_PREFIX}${userId}`;
        await this.redis.setex(
          lockKey,
          USER_CONSTANTS.LOCK_DURATION_MINUTES * 60,
          '1',
        );

        this.logger.warn(
          { userId, failedAttempts: count },
          USER_LOG_MESSAGES.ACCOUNT_LOCKED,
        );
      }
    } catch (err: unknown) {
      this.logger.warn(
        { err, userId },
        'Failed to record brute force attempt (Redis unavailable)',
      );
    }
  }

  async isLocked(userId: string): Promise<boolean> {
    try {
      const lockKey = `${USER_CONSTANTS.BRUTE_FORCE_LOCK_KEY_PREFIX}${userId}`;
      const locked = await this.redis.get(lockKey);

      if (locked) {
        return true;
      }

      const user = await this.userRepository.findById(userId);
      if (user?.status === 'LOCKED' && user.lockUntil) {
        if (user.lockUntil > new Date()) {
          const ttlSeconds = Math.ceil(
            (user.lockUntil.getTime() - Date.now()) / 1000,
          );
          await this.redis.setex(lockKey, ttlSeconds, '1');
          return true;
        }

        await this.userRepository.resetFailedLoginAttempts(userId);
        return false;
      }

      return false;
    } catch (err: unknown) {
      this.logger.warn(
        { err, userId },
        'Failed to check lock status (Redis unavailable)',
      );
      return false;
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
      const count = await this.redis.incr(key);

      if (count === 1) {
        await this.redis.expire(
          key,
          USER_CONSTANTS.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
        );
      }

      if (count > USER_CONSTANTS.LOGIN_RATE_LIMIT_PER_ACCOUNT) {
        this.logger.warn({ email }, 'Account rate limit exceeded');
        return false;
      }

      return true;
    } catch (err: unknown) {
      this.logger.warn(
        { err, email },
        'Failed to check account rate limit (Redis unavailable)',
      );
      return true;
    }
  }
}
