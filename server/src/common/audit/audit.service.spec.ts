/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';

import { AuditService } from './audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createLoggerMock } from '../../testing/mocks';

// Audit writes are detached (fire-and-forget); flush pending microtasks/timers
// so background completion (debug/error logging) can be asserted.
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('AuditService', () => {
  let service: AuditService;

  const prisma = {
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const logger = createLoggerMock();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prisma },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      await service.log({
        userId: 'user-1',
        event: 'LOGIN_SUCCESS',
        metadata: { ip: '127.0.0.1' },
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      });

      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: {
          userId: string;
          event: string;
          metadata: Record<string, unknown>;
          ipAddress: string;
          userAgent: string;
        };
      };
      expect(call.data.userId).toBe('user-1');
      expect(call.data.event).toBe('LOGIN_SUCCESS');
      expect(call.data.metadata).toEqual({ ip: '127.0.0.1' });
      expect(call.data.ipAddress).toBe('127.0.0.1');
      expect(call.data.userAgent).toBe('Mozilla/5.0');
      await flush();
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should work without optional fields', async () => {
      await service.log({ event: 'LOGIN_FAILED' });

      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { userId: string | undefined; event: string };
      };
      expect(call.data.userId).toBeUndefined();
      expect(call.data.event).toBe('LOGIN_FAILED');
    });

    it('should not throw on database error', async () => {
      prisma.auditLog.create.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.log({ event: 'LOGIN_SUCCESS', userId: 'user-1' }),
      ).resolves.not.toThrow();

      await flush();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('logOtpGenerated', () => {
    it('should log OTP_GENERATED event', async () => {
      await service.logOtpGenerated('user-1', { type: 'EMAIL_VERIFICATION' });
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('OTP_GENERATED');
    });
  });

  describe('logOtpResent', () => {
    it('should log OTP_RESENT event', async () => {
      await service.logOtpResent('user-1');
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('OTP_RESENT');
    });
  });

  describe('logOtpVerified', () => {
    it('should log OTP_VERIFIED event', async () => {
      await service.logOtpVerified('user-1');
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('OTP_VERIFIED');
    });
  });

  describe('logOtpFailed', () => {
    it('should log OTP_FAILED event', async () => {
      await service.logOtpFailed('user-1');
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('OTP_FAILED');
    });
  });

  describe('logOtpExpired', () => {
    it('should log OTP_EXPIRED event', async () => {
      await service.logOtpExpired('user-1');
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('OTP_EXPIRED');
    });
  });

  describe('logOtpRateLimited', () => {
    it('should log OTP_RATE_LIMITED event', async () => {
      await service.logOtpRateLimited('user-1');
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('OTP_RATE_LIMITED');
    });
  });

  describe('logOtpMaxAttempts', () => {
    it('should log OTP_MAX_ATTEMPTS event', async () => {
      await service.logOtpMaxAttempts('user-1');
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('OTP_MAX_ATTEMPTS');
    });
  });

  describe('logOtpResendCooldown', () => {
    it('should log OTP_RESEND_COOLDOWN event', async () => {
      await service.logOtpResendCooldown('user-1');
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('OTP_RESEND_COOLDOWN');
    });
  });

  describe('logEmailVerificationSuccess', () => {
    it('should log EMAIL_VERIFICATION_SUCCESS event', async () => {
      await service.logEmailVerificationSuccess('user-1');
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('EMAIL_VERIFICATION_SUCCESS');
    });
  });

  describe('logEmailVerificationFailed', () => {
    it('should log EMAIL_VERIFICATION_FAILED event', async () => {
      await service.logEmailVerificationFailed('user-1');
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('EMAIL_VERIFICATION_FAILED');
    });
  });

  describe('logLoginSuccess', () => {
    it('should log LOGIN_SUCCESS with IP and user agent', async () => {
      await service.logLoginSuccess('user-1', {}, '127.0.0.1', 'Mozilla/5.0');
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string; ipAddress: string; userAgent: string };
      };
      expect(call.data.event).toBe('LOGIN_SUCCESS');
      expect(call.data.ipAddress).toBe('127.0.0.1');
      expect(call.data.userAgent).toBe('Mozilla/5.0');
    });
  });

  describe('logLoginFailed', () => {
    it('should log LOGIN_FAILED without userId', async () => {
      await service.logLoginFailed({ reason: 'bad_password' }, '127.0.0.1');
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string; userId: string | undefined; ipAddress: string };
      };
      expect(call.data.event).toBe('LOGIN_FAILED');
      expect(call.data.userId).toBeUndefined();
      expect(call.data.ipAddress).toBe('127.0.0.1');
    });
  });

  describe('logAccountLocked', () => {
    it('should log ACCOUNT_LOCKED event', async () => {
      await service.logAccountLocked(
        'user-1',
        { attempts: 5 },
        '127.0.0.1',
        'Mozilla/5.0',
      );
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string; userId: string };
      };
      expect(call.data.event).toBe('ACCOUNT_LOCKED');
      expect(call.data.userId).toBe('user-1');
    });
  });

  describe('logAccountUnlocked', () => {
    it('should log ACCOUNT_UNLOCKED event', async () => {
      await service.logAccountUnlocked('user-1');
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('ACCOUNT_UNLOCKED');
    });
  });

  describe('logSessionCreated', () => {
    it('should log SESSION_CREATED event', async () => {
      await service.logSessionCreated('user-1', {}, '127.0.0.1', 'Mozilla/5.0');
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('SESSION_CREATED');
    });
  });

  describe('logSessionRevoked', () => {
    it('should log SESSION_REVOKED event', async () => {
      await service.logSessionRevoked('user-1', {}, '127.0.0.1');
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('SESSION_REVOKED');
    });
  });

  describe('logRefreshTokenIssued', () => {
    it('should log REFRESH_TOKEN_ISSUED event', async () => {
      await service.logRefreshTokenIssued(
        'user-1',
        {},
        '127.0.0.1',
        'Mozilla/5.0',
      );
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('REFRESH_TOKEN_ISSUED');
    });
  });

  describe('logRefreshTokenReuse', () => {
    it('should log REFRESH_TOKEN_REUSE event', async () => {
      await service.logRefreshTokenReuse('user-1', {
        reusedSessionId: 'session-1',
      });
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('REFRESH_TOKEN_REUSE');
    });
  });

  describe('logGlobalLogout', () => {
    it('should log GLOBAL_LOGOUT event', async () => {
      await service.logGlobalLogout(
        'user-1',
        { revokedCount: 3 },
        '127.0.0.1',
        'Mozilla/5.0',
      );
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('GLOBAL_LOGOUT');
    });
  });

  describe('logPasswordChanged', () => {
    it('should log PASSWORD_CHANGED event', async () => {
      await service.logPasswordChanged(
        'user-1',
        { tokenVersion: 2 },
        '127.0.0.1',
        'Mozilla/5.0',
      );
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('PASSWORD_CHANGED');
    });
  });

  describe('logRefreshFailed', () => {
    it('should log REFRESH_FAILED event', async () => {
      await service.logRefreshFailed('user-1', { reason: 'session_revoked' });
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('REFRESH_FAILED');
    });
  });

  describe('logSessionExpiredAttempt', () => {
    it('should log SESSION_EXPIRED_ATTEMPT event', async () => {
      await service.logSessionExpiredAttempt('user-1', {
        sessionId: 'session-1',
      });
      const call = prisma.auditLog.create.mock.calls[0][0] as {
        data: { event: string };
      };
      expect(call.data.event).toBe('SESSION_EXPIRED_ATTEMPT');
    });
  });
});
