import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';

import { UserLoginService } from './user-login.service';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { BruteForceService } from './brute-force.service';
import { AuditService } from '../../common/audit/audit.service';
import { createLoggerMock } from '../../testing/mocks';

jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn().mockResolvedValue('equalized-hash'),
}));

jest.mock('../utils/auth.utils', () => ({
  normalizeEmail: jest.fn((email: string) => email.trim().toLowerCase()),
  hashRefreshToken: jest.fn(() => 'hashed-token'),
  parseUserAgent: jest.fn(() => ({ browser: 'Chrome', os: 'Windows' })),
  daysFromNow: jest.fn((days: number) => {
    const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
    return new Date(Date.now() + days * MILLISECONDS_PER_DAY);
  }),
}));

describe('UserLoginService', () => {
  let service: UserLoginService;

  const repository = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updateLastLoginMetadata: jest.fn(),
    incrementTokenVersion: jest.fn(),
  };

  const sessionRepository = {
    create: jest.fn(),
    findByRefreshTokenHash: jest.fn(),
    findSessionContextForRefresh: jest.fn(),
    revoke: jest.fn(),
    updateLastUsed: jest.fn(),
    findActiveByUserId: jest.fn(),
    findById: jest.fn(),
    rotateSession: jest.fn(),
    updateRefreshTokenHash: jest.fn(),
    findRecentlyRevokedByUserId: jest.fn(),
    revokeAllForUser: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('jwt-token'),
    verify: jest.fn(),
  };

  const configService = {
    getOrThrow: jest.fn().mockReturnValue('secret-key'),
  };

  const bruteForceService = {
    checkAndRecordFailedAttempt: jest.fn(),
    isLocked: jest.fn().mockResolvedValue(false),
    resetFailedAttempts: jest.fn(),
    checkAccountRateLimit: jest.fn().mockResolvedValue(true),
  };

  const auditService = {
    log: jest.fn(),
    logRefreshTokenIssued: jest.fn(),
    logRefreshTokenReuse: jest.fn(),
    logRefreshFailed: jest.fn(),
    logSessionExpiredAttempt: jest.fn(),
    logGlobalLogout: jest.fn(),
  };

  const logger = createLoggerMock();

  beforeEach(async () => {
    jest.clearAllMocks();
    jwtService.signAsync.mockResolvedValue('jwt-token');
    configService.getOrThrow.mockReturnValue('secret-key');
    bruteForceService.isLocked.mockResolvedValue(false);
    bruteForceService.checkAccountRateLimit.mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserLoginService,
        { provide: UserRepository, useValue: repository },
        { provide: SessionRepository, useValue: sessionRepository },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: BruteForceService, useValue: bruteForceService },
        { provide: AuditService, useValue: auditService },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(UserLoginService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const dto = { email: 'test@example.com', password: 'password123' };
    const ip = '127.0.0.1';
    const userAgent = 'Mozilla/5.0';

    it('should login successfully and create session', async () => {
      const user = {
        id: 'user-1',
        email: dto.email,
        passwordHash: 'hashed-password',
        status: 'ACTIVE',
        emailVerified: true,
        tokenVersion: 0,
      };
      repository.findByEmail.mockResolvedValue(user);
      sessionRepository.findActiveByUserId.mockResolvedValue([]);
      sessionRepository.create.mockResolvedValue({ id: 'session-1' });

      const argon2 = jest.requireMock<typeof import('argon2')>('argon2');
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login(dto, ip, userAgent);

      expect(result).toEqual({
        accessToken: 'jwt-token',
        refreshToken: 'jwt-token',
        expiresIn: 900,
        tokenType: 'Bearer',
      });
      // Login must NOT bump tokenVersion (that would log out other devices).
      expect(repository.incrementTokenVersion).not.toHaveBeenCalled();
      expect(repository.updateLastLoginMetadata).toHaveBeenCalledWith(
        'user-1',
        ip,
        userAgent,
      );
      expect(sessionRepository.create).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'LOGIN_SUCCESS' }),
      );
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      repository.findByEmail.mockResolvedValue(null);

      await expect(service.login(dto, ip, userAgent)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'LOGIN_FAILED' }),
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const user = {
        id: 'user-1',
        email: dto.email,
        passwordHash: 'hashed-password',
        status: 'ACTIVE',
        emailVerified: true,
        tokenVersion: 0,
      };
      repository.findByEmail.mockResolvedValue(user);

      const argon2 = jest.requireMock<typeof import('argon2')>('argon2');
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto, ip, userAgent)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(
        bruteForceService.checkAndRecordFailedAttempt,
      ).toHaveBeenCalledWith('user-1');
    });

    it('should throw generic UnauthorizedException for a locked account without verifying the password or recording a new failure', async () => {
      const user = {
        id: 'user-1',
        email: dto.email,
        passwordHash: 'hashed-password',
        status: 'ACTIVE',
        emailVerified: true,
        tokenVersion: 0,
      };
      repository.findByEmail.mockResolvedValue(user);
      bruteForceService.isLocked.mockResolvedValue(true);

      const argon2 = jest.requireMock<typeof import('argon2')>('argon2');
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      // Locked accounts are rejected with the same generic error as a wrong
      // password (no enumeration) before the password is ever checked.
      await expect(service.login(dto, ip, userAgent)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(argon2.verify).not.toHaveBeenCalled();
      // The lock window must not be extended by attempts made while locked.
      expect(
        bruteForceService.checkAndRecordFailedAttempt,
      ).not.toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'LOGIN_FAILED',
          metadata: { reason: 'account_locked' },
        }),
      );
    });

    it('should throw ForbiddenException for disabled account', async () => {
      const user = {
        id: 'user-1',
        email: dto.email,
        passwordHash: 'hashed-password',
        status: 'DISABLED',
        emailVerified: true,
        tokenVersion: 0,
      };
      repository.findByEmail.mockResolvedValue(user);

      const argon2 = jest.requireMock<typeof import('argon2')>('argon2');
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.login(dto, ip, userAgent)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for pending verification', async () => {
      const user = {
        id: 'user-1',
        email: dto.email,
        passwordHash: 'hashed-password',
        status: 'PENDING_VERIFICATION',
        emailVerified: false,
        tokenVersion: 0,
      };
      repository.findByEmail.mockResolvedValue(user);

      const argon2 = jest.requireMock<typeof import('argon2')>('argon2');
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.login(dto, ip, userAgent)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for unverified email', async () => {
      const user = {
        id: 'user-1',
        email: dto.email,
        passwordHash: 'hashed-password',
        status: 'ACTIVE',
        emailVerified: false,
        tokenVersion: 0,
      };
      repository.findByEmail.mockResolvedValue(user);

      const argon2 = jest.requireMock<typeof import('argon2')>('argon2');
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.login(dto, ip, userAgent)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw UnauthorizedException when rate limited', async () => {
      bruteForceService.checkAccountRateLimit.mockResolvedValue(false);

      await expect(service.login(dto, ip, userAgent)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('should refresh token successfully with session rotation', async () => {
      const payload = {
        sub: 'user-1',
        tokenVersion: 0,
        iss: 'tinylink',
        aud: 'tinylink-api',
        jti: 'test-jti',
        sessionId: 'session-1',
        type: 'refresh',
      };
      jwtService.verify.mockReturnValue(payload);

      const user = { id: 'user-1', tokenVersion: 0 };
      repository.findById.mockResolvedValue(user);

      sessionRepository.findSessionContextForRefresh.mockResolvedValue({
        status: 'active',
        session: {
          id: 'session-1',
          userId: 'user-1',
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      sessionRepository.rotateSession.mockResolvedValue({
        session: { id: 'session-2' },
      });
      sessionRepository.updateRefreshTokenHash.mockResolvedValue(undefined);

      const result = await service.refresh(
        'refresh-token',
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(result).toEqual({
        accessToken: 'jwt-token',
        refreshToken: 'jwt-token',
        expiresIn: 900,
        tokenType: 'Bearer',
      });
      expect(sessionRepository.rotateSession).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          refreshTokenHash: expect.any(String),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          lastUsedAt: expect.any(Date),
        }),
      );
      expect(auditService.logRefreshTokenIssued).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          oldSessionId: 'session-1',
          newSessionId: 'session-2',
        }),
      );
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(
        service.refresh('invalid-token', '127.0.0.1', 'Mozilla/5.0'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException with SESSION_REVOKED for revoked session', async () => {
      const payload = {
        sub: 'user-1',
        tokenVersion: 0,
        iss: 'tinylink',
        aud: 'tinylink-api',
        type: 'refresh',
      };
      jwtService.verify.mockReturnValue(payload);

      const user = { id: 'user-1', tokenVersion: 0 };
      repository.findById.mockResolvedValue(user);

      sessionRepository.findSessionContextForRefresh.mockResolvedValue({
        status: 'revoked',
        session: {
          id: 'session-1',
          userId: 'user-1',
          refreshTokenHash: 'hashed-token',
        },
      });
      sessionRepository.findRecentlyRevokedByUserId.mockResolvedValue([]);

      await expect(
        service.refresh('refresh-token', '127.0.0.1', 'Mozilla/5.0'),
      ).rejects.toThrow(UnauthorizedException);

      expect(auditService.logRefreshFailed).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ reason: 'session_revoked' }),
      );
    });

    it('should throw UnauthorizedException with SESSION_EXPIRED for expired session', async () => {
      const payload = {
        sub: 'user-1',
        tokenVersion: 0,
        iss: 'tinylink',
        aud: 'tinylink-api',
        type: 'refresh',
      };
      jwtService.verify.mockReturnValue(payload);

      const user = { id: 'user-1', tokenVersion: 0 };
      repository.findById.mockResolvedValue(user);

      sessionRepository.findSessionContextForRefresh.mockResolvedValue({
        status: 'expired',
        session: { id: 'session-1', userId: 'user-1' },
      });

      await expect(
        service.refresh('refresh-token', '127.0.0.1', 'Mozilla/5.0'),
      ).rejects.toThrow(UnauthorizedException);

      expect(auditService.logSessionExpiredAttempt).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ sessionId: 'session-1' }),
      );
    });

    it('should throw UnauthorizedException for token version mismatch', async () => {
      const payload = {
        sub: 'user-1',
        tokenVersion: 1,
        iss: 'tinylink',
        aud: 'tinylink-api',
        type: 'refresh',
      };
      jwtService.verify.mockReturnValue(payload);

      const user = { id: 'user-1', tokenVersion: 0 };
      repository.findById.mockResolvedValue(user);

      sessionRepository.findSessionContextForRefresh.mockResolvedValue({
        status: 'active',
        session: {
          id: 'session-1',
          userId: 'user-1',
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      await expect(
        service.refresh('refresh-token', '127.0.0.1', 'Mozilla/5.0'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for not_found session', async () => {
      const payload = {
        sub: 'user-1',
        tokenVersion: 0,
        iss: 'tinylink',
        aud: 'tinylink-api',
        type: 'refresh',
      };
      jwtService.verify.mockReturnValue(payload);

      sessionRepository.findSessionContextForRefresh.mockResolvedValue({
        status: 'not_found',
      });
      sessionRepository.findRecentlyRevokedByUserId.mockResolvedValue([]);

      await expect(
        service.refresh('refresh-token', '127.0.0.1', 'Mozilla/5.0'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should revoke session and audit log', async () => {
      sessionRepository.findById.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
      });
      sessionRepository.revoke.mockResolvedValue({});

      await service.logout('user-1', 'session-1', '127.0.0.1', 'Mozilla/5.0');

      expect(sessionRepository.revoke).toHaveBeenCalledWith('session-1');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'SESSION_REVOKED' }),
      );
    });

    it('should throw if session not found', async () => {
      sessionRepository.findById.mockResolvedValue(null);

      await expect(
        service.logout('user-1', 'session-1', '127.0.0.1', 'Mozilla/5.0'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if session belongs to different user', async () => {
      sessionRepository.findById.mockResolvedValue({
        id: 'session-1',
        userId: 'user-2',
      });

      await expect(
        service.logout('user-1', 'session-1', '127.0.0.1', 'Mozilla/5.0'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions for user', async () => {
      const sessions = [{ id: 'session-1' }, { id: 'session-2' }];
      sessionRepository.findActiveByUserId.mockResolvedValue(sessions);

      const result = await service.getActiveSessions('user-1');

      expect(result).toEqual(sessions);
    });
  });

  describe('revokeSession', () => {
    it('should revoke specific session', async () => {
      sessionRepository.findById.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
      });
      sessionRepository.revoke.mockResolvedValue({});

      await service.revokeSession(
        'user-1',
        'session-1',
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(sessionRepository.revoke).toHaveBeenCalledWith('session-1');
    });

    it('should throw UnauthorizedException for invalid session', async () => {
      sessionRepository.findById.mockResolvedValue(null);

      await expect(
        service.revokeSession(
          'user-1',
          'session-1',
          '127.0.0.1',
          'Mozilla/5.0',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for session belonging to different user', async () => {
      sessionRepository.findById.mockResolvedValue({
        id: 'session-1',
        userId: 'user-2',
      });

      await expect(
        service.revokeSession(
          'user-1',
          'session-1',
          '127.0.0.1',
          'Mozilla/5.0',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
