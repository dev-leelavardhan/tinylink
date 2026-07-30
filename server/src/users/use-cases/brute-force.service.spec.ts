import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';

import { BruteForceService } from './brute-force.service';
import { UserRepository } from '../repositories/user.repository';
import { RedisService } from '../../redis/service/redis.service';
import { USER_CONSTANTS } from '../constants/user.constants';
import { createLoggerMock } from '../../testing/mocks';

describe('BruteForceService', () => {
  let service: BruteForceService;

  const userRepository = {
    findById: jest.fn(),
    lockAccount: jest.fn(),
    resetFailedLoginAttempts: jest.fn(),
  };

  const redisMultiChain = {
    incr: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };

  const redis = {
    multi: jest.fn().mockReturnValue(redisMultiChain),
    incr: jest.fn(),
    expire: jest.fn(),
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  };

  const logger = createLoggerMock();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BruteForceService,
        { provide: UserRepository, useValue: userRepository },
        { provide: RedisService, useValue: redis },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(BruteForceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkAndRecordFailedAttempt', () => {
    it('should increment failed attempts counter', async () => {
      redisMultiChain.exec.mockResolvedValue([[null, 1]]);

      await service.checkAndRecordFailedAttempt('user-1');

      expect(redis.multi).toHaveBeenCalled();
      expect(redisMultiChain.incr).toHaveBeenCalledWith(
        `${USER_CONSTANTS.BRUTE_FORCE_KEY_PREFIX}user-1`,
      );
      expect(redisMultiChain.expire).toHaveBeenCalledWith(
        `${USER_CONSTANTS.BRUTE_FORCE_KEY_PREFIX}user-1`,
        USER_CONSTANTS.LOCK_DURATION_MINUTES * 60,
      );
    });

    it('should lock account when max attempts exceeded', async () => {
      redisMultiChain.exec.mockResolvedValue([
        [null, USER_CONSTANTS.MAX_FAILED_LOGIN_ATTEMPTS],
      ]);
      userRepository.lockAccount.mockResolvedValue({});

      await service.checkAndRecordFailedAttempt('user-1');

      expect(userRepository.lockAccount).toHaveBeenCalledWith(
        'user-1',
        expect.any(Date),
      );
      expect(redis.setex).toHaveBeenCalledWith(
        `${USER_CONSTANTS.BRUTE_FORCE_LOCK_KEY_PREFIX}user-1`,
        USER_CONSTANTS.LOCK_DURATION_MINUTES * 60,
        '1',
      );
    });

    it('should NOT record a new failure while already locked (fixed window)', async () => {
      redis.get.mockResolvedValue('1'); // active lock present

      await service.checkAndRecordFailedAttempt('user-1');

      expect(redis.multi).not.toHaveBeenCalled();
      expect(userRepository.lockAccount).not.toHaveBeenCalled();
    });

    it('should clear the attempt counter when locking so the next window starts clean', async () => {
      redis.get.mockResolvedValue(null);
      redisMultiChain.exec.mockResolvedValue([
        [null, USER_CONSTANTS.MAX_FAILED_LOGIN_ATTEMPTS],
      ]);
      userRepository.lockAccount.mockResolvedValue({});

      await service.checkAndRecordFailedAttempt('user-1');

      expect(redis.del).toHaveBeenCalledWith(
        `${USER_CONSTANTS.BRUTE_FORCE_KEY_PREFIX}user-1`,
      );
    });

    it('should handle Redis failure gracefully', async () => {
      redisMultiChain.exec.mockRejectedValue(new Error('Redis unavailable'));

      await service.checkAndRecordFailedAttempt('user-1');

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('isLocked', () => {
    it('should return true when locked in Redis', async () => {
      redis.get.mockResolvedValue('1');

      const result = await service.isLocked('user-1');

      expect(result).toBe(true);
    });

    it('should check database when not in Redis', async () => {
      redis.get.mockResolvedValue(null);
      userRepository.findById.mockResolvedValue({
        id: 'user-1',
        status: 'LOCKED',
        lockUntil: new Date(Date.now() + 600000),
      });

      const result = await service.isLocked('user-1');

      expect(result).toBe(true);
    });

    it('should unlock account when lock expired', async () => {
      redis.get.mockResolvedValue(null);
      userRepository.findById.mockResolvedValue({
        id: 'user-1',
        status: 'LOCKED',
        lockUntil: new Date(Date.now() - 1000),
      });
      userRepository.resetFailedLoginAttempts.mockResolvedValue({});

      const result = await service.isLocked('user-1');

      expect(result).toBe(false);
      expect(userRepository.resetFailedLoginAttempts).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('should return false when not locked', async () => {
      redis.get.mockResolvedValue(null);
      userRepository.findById.mockResolvedValue({
        id: 'user-1',
        status: 'ACTIVE',
        lockUntil: null,
      });

      const result = await service.isLocked('user-1');

      expect(result).toBe(false);
    });

    it('should handle Redis failure gracefully', async () => {
      redis.get.mockRejectedValue(new Error('Redis unavailable'));

      const result = await service.isLocked('user-1');

      expect(result).toBe(false);
    });
  });

  describe('resetFailedAttempts', () => {
    it('should reset Redis keys and database', async () => {
      redis.del.mockResolvedValue(1);
      userRepository.findById.mockResolvedValue({
        id: 'user-1',
        status: 'LOCKED',
      });
      userRepository.resetFailedLoginAttempts.mockResolvedValue({});

      await service.resetFailedAttempts('user-1');

      expect(redis.del).toHaveBeenCalledWith(
        `${USER_CONSTANTS.BRUTE_FORCE_KEY_PREFIX}user-1`,
      );
      expect(redis.del).toHaveBeenCalledWith(
        `${USER_CONSTANTS.BRUTE_FORCE_LOCK_KEY_PREFIX}user-1`,
      );
      expect(userRepository.resetFailedLoginAttempts).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('should not reset database if account not locked', async () => {
      redis.del.mockResolvedValue(1);
      userRepository.findById.mockResolvedValue({
        id: 'user-1',
        status: 'ACTIVE',
      });

      await service.resetFailedAttempts('user-1');

      expect(userRepository.resetFailedLoginAttempts).not.toHaveBeenCalled();
    });

    it('should handle Redis failure gracefully', async () => {
      redis.del.mockRejectedValue(new Error('Redis unavailable'));

      await service.resetFailedAttempts('user-1');

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('checkAccountRateLimit', () => {
    it('should allow request within rate limit', async () => {
      redisMultiChain.exec.mockResolvedValue([[null, 1]]);

      const result = await service.checkAccountRateLimit('test@example.com');

      expect(result).toBe(true);
    });

    it('should block request exceeding rate limit', async () => {
      redisMultiChain.exec.mockResolvedValue([
        [null, USER_CONSTANTS.LOGIN_RATE_LIMIT_PER_ACCOUNT + 1],
      ]);

      const result = await service.checkAccountRateLimit('test@example.com');

      expect(result).toBe(false);
    });

    it('should deny request in production when Redis is unavailable (fail-closed)', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      redisMultiChain.exec.mockRejectedValue(new Error('Redis unavailable'));

      const result = await service.checkAccountRateLimit('test@example.com');

      expect(result).toBe(false);
      process.env.NODE_ENV = originalEnv;
    });

    it('should allow request in non-production when Redis is unavailable (fail-open)', async () => {
      redisMultiChain.exec.mockRejectedValue(new Error('Redis unavailable'));

      const result = await service.checkAccountRateLimit('test@example.com');

      expect(result).toBe(true);
    });
  });
});
