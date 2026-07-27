import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';

import { UserOtpService } from './user-otp.service';
import { RedisService } from '../../redis/service/redis.service';
import { UserRepository } from '../repositories/user.repository';
import { createLoggerMock } from '../../testing/mocks';
import { AuditService } from '../../common/audit/audit.service';

describe('UserOtpService', () => {
  let service: UserOtpService;

  const redisMultiChain = {
    incr: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };

  const redis = {
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    multi: jest.fn().mockReturnValue(redisMultiChain),
  };

  const repository = {
    createOtp: jest.fn().mockResolvedValue({}),
    findValidOtp: jest.fn(),
    markOtpUsed: jest.fn().mockResolvedValue({}),
  };

  const auditService = {
    logOtpGenerated: jest.fn().mockResolvedValue(undefined),
    logOtpResent: jest.fn().mockResolvedValue(undefined),
    logOtpVerified: jest.fn().mockResolvedValue(undefined),
    logOtpFailed: jest.fn().mockResolvedValue(undefined),
    logOtpExpired: jest.fn().mockResolvedValue(undefined),
    logOtpRateLimited: jest.fn().mockResolvedValue(undefined),
    logOtpMaxAttempts: jest.fn().mockResolvedValue(undefined),
    logOtpResendCooldown: jest.fn().mockResolvedValue(undefined),
  };

  const logger = createLoggerMock();

  beforeEach(async () => {
    jest.clearAllMocks();
    // Default: no rate limit, no attempts
    redis.get.mockResolvedValue(null);
    redisMultiChain.exec.mockResolvedValue([[null, 1]]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserOtpService,
        { provide: RedisService, useValue: redis },
        { provide: UserRepository, useValue: repository },
        { provide: AuditService, useValue: auditService },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(UserOtpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generate', () => {
    it('should store OTP in both Redis and DB', async () => {
      const otp = await service.generate('user-1', 'test@example.com');

      expect(otp).toHaveLength(6);
      expect(/^\d+$/.test(otp)).toBe(true);
      expect(redis.setex).toHaveBeenCalledWith(
        'otp:verify:user-1',
        600,
        expect.any(String),
      );
      expect(repository.createOtp).toHaveBeenCalledWith({
        userId: 'user-1',
        email: 'test@example.com',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        otpHash: expect.any(String),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        salt: expect.any(String),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expiresAt: expect.any(Date),
        type: 'EMAIL_VERIFICATION',
      });
    });

    it('should still work if Redis fails', async () => {
      redis.setex.mockRejectedValueOnce(new Error('Redis down'));

      const otp = await service.generate('user-1', 'test@example.com');

      expect(otp).toHaveLength(6);
      expect(repository.createOtp).toHaveBeenCalled();
    });

    it('should still work if DB fails', async () => {
      repository.createOtp.mockRejectedValueOnce(new Error('DB down'));

      const otp = await service.generate('user-1', 'test@example.com');

      expect(otp).toHaveLength(6);
      expect(redis.setex).toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('should return email on valid OTP from Redis', async () => {
      const generatedOtp = await service.generate('user-1', 'test@example.com');

      // Get the stored value that was written to Redis
      const storedValue = redis.setex.mock.calls.find(
        (call: unknown[]) => call[0] === 'otp:verify:user-1',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      )![2] as string;

      // Mock redis.get to return the stored value for the OTP key
      redis.get.mockImplementation((key: string) => {
        if (key === 'otp:ratelimit:user-1') return Promise.resolve(null);
        if (key === 'otp:attempts:user-1') return Promise.resolve(null);
        if (key === 'otp:verify:user-1') return Promise.resolve(storedValue);
        return Promise.resolve(null);
      });

      const result = await service.verify('user-1', generatedOtp);

      expect(result).toEqual({ email: 'test@example.com' });
      expect(redis.del).toHaveBeenCalledWith('otp:verify:user-1');
      expect(repository.markOtpUsed).toHaveBeenCalledWith(
        'user-1',
        'EMAIL_VERIFICATION',
      );
    });

    it('should fallback to DB if Redis fails', async () => {
      const generatedOtp = await service.generate('user-1', 'test@example.com');

      // Get the stored value from Redis
      const storedValue = redis.setex.mock.calls.find(
        (call: unknown[]) => call[0] === 'otp:verify:user-1',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      )![2] as string;
      const { hashedOtp, salt } = JSON.parse(storedValue) as {
        hashedOtp: string;
        salt: string;
      };

      // Redis fails for OTP lookup
      redis.get.mockImplementation((key: string) => {
        if (key === 'otp:ratelimit:user-1') return Promise.resolve(null);
        if (key === 'otp:attempts:user-1') return Promise.resolve(null);
        if (key === 'otp:verify:user-1')
          return Promise.reject(new Error('Redis down'));
        return Promise.resolve(null);
      });

      // DB has the record with correct hash and salt
      repository.findValidOtp.mockResolvedValueOnce({
        otpHash: hashedOtp,
        salt,
        email: 'test@example.com',
      });

      const result = await service.verify('user-1', generatedOtp);

      expect(result).toEqual({ email: 'test@example.com' });
    });

    it('should return null for invalid OTP', async () => {
      await service.generate('user-1', 'test@example.com');

      redis.get.mockImplementation((key: string) => {
        if (key === 'otp:ratelimit:user-1') return Promise.resolve(null);
        if (key === 'otp:attempts:user-1') return Promise.resolve(null);
        if (key === 'otp:verify:user-1')
          return Promise.resolve(
            JSON.stringify({
              hashedOtp: 'wrong-hash',
              email: 'test@example.com',
            }),
          );
        return Promise.resolve(null);
      });
      repository.findValidOtp.mockResolvedValueOnce(null);

      const result = await service.verify('user-1', '000000');

      expect(result).toBeNull();
    });

    it('should return null if OTP not found', async () => {
      redis.get.mockImplementation((key: string) => {
        if (key === 'otp:ratelimit:user-1') return Promise.resolve(null);
        if (key === 'otp:attempts:user-1') return Promise.resolve(null);
        return Promise.resolve(null);
      });
      repository.findValidOtp.mockResolvedValueOnce(null);

      const result = await service.verify('user-1', '123456');

      expect(result).toBeNull();
    });

    it('should track failed attempts', async () => {
      redis.get.mockImplementation((key: string) => {
        if (key === 'otp:ratelimit:user-1') return Promise.resolve(null);
        if (key === 'otp:attempts:user-1') return Promise.resolve(null);
        return Promise.resolve(null);
      });
      redisMultiChain.exec
        .mockResolvedValueOnce([[null, 1]]) // rate limit
        .mockResolvedValueOnce([[null, 1]]); // attempts increment
      repository.findValidOtp.mockResolvedValueOnce(null);

      await service.verify('user-1', '000000');

      // Should have tried to increment attempts via multi chain
      expect(redis.multi).toHaveBeenCalled();
      expect(redisMultiChain.incr).toHaveBeenCalledWith(
        'otp:attempts:otp:verify:user-1',
      );
    });

    it('should block after max attempts', async () => {
      redis.get.mockImplementation((key: string) => {
        if (key === 'otp:ratelimit:user-1') return Promise.resolve(null);
        if (key === 'otp:attempts:user-1') return Promise.resolve('5');
        return Promise.resolve(null);
      });
      redis.incr.mockResolvedValueOnce(1); // rate limit
      repository.findValidOtp.mockResolvedValueOnce(null);

      const result = await service.verify('user-1', '123456');

      expect(result).toBeNull();
    });
  });

  describe('resend', () => {
    it('should generate new OTP and invalidate old ones', async () => {
      redis.get.mockImplementation((key: string) => {
        if (key === 'otp:cooldown:user-1') return Promise.resolve(null);
        if (key === 'otp:ratelimit:user-1') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const otp = await service.resend('user-1', 'test@example.com');

      expect(otp).toHaveLength(6);
      expect(repository.markOtpUsed).toHaveBeenCalledWith(
        'user-1',
        'EMAIL_VERIFICATION',
      );
      expect(redis.del).toHaveBeenCalledWith('otp:verify:user-1');
    });

    it('should reset attempts counter on resend', async () => {
      redis.get.mockImplementation((key: string) => {
        if (key === 'otp:cooldown:user-1') return Promise.resolve(null);
        if (key === 'otp:ratelimit:user-1') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      await service.resend('user-1', 'test@example.com');

      expect(redis.del).toHaveBeenCalledWith('otp:attempts:user-1');
    });

    it('should respect cooldown period', async () => {
      redis.get.mockImplementation((key: string) => {
        if (key === 'otp:cooldown:user-1') return Promise.resolve('1');
        return Promise.resolve(null);
      });

      const result = await service.resend('user-1', 'test@example.com');

      expect(result).toBeNull();
    });

    it('should respect rate limiting', async () => {
      redis.get.mockImplementation((key: string) => {
        if (key === 'otp:cooldown:user-1') return Promise.resolve(null);
        return Promise.resolve(null);
      });
      redisMultiChain.exec.mockResolvedValue([[null, 4]]); // exceeds limit of 3

      const result = await service.resend('user-1', 'test@example.com');

      expect(result).toBeNull();
    });
  });
});
