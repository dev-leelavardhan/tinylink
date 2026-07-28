import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { AuthController } from './auth.controller';
import { UsersService } from '../service/users.service';
import { SessionMapper } from '../mappers/session.mapper';

jest.mock('../utils/auth.utils', () => ({
  normalizeEmail: jest.fn((email: string) => email.trim().toLowerCase()),
  hashRefreshToken: jest.fn(() => 'hashed-token'),
  parseUserAgent: jest.fn(() => ({ browser: 'Chrome', os: 'Windows' })),
  getClientIp: jest.fn(() => '127.0.0.1'),
  setRefreshTokenCookie: jest.fn(),
  clearRefreshTokenCookie: jest.fn(),
  getRefreshTokenFromCookie: jest.fn(
    (cookies: Record<string, string>) => cookies?.refresh_token ?? null,
  ),
}));

function createMockRequest(overrides: Partial<Request> = {}): Request & {
  user?: { userId: string };
  cookies: Record<string, string>;
} {
  return {
    headers: {},
    ip: '127.0.0.1',
    cookies: {},
    ...overrides,
  } as Request & {
    user?: { userId: string };
    cookies: Record<string, string>;
  };
}

function createMockResponse(): Response {
  return { cookie: jest.fn() } as unknown as Response;
}

describe('AuthController', () => {
  let controller: AuthController;
  let usersService: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
    logoutAll: jest.Mock;
    getActiveSessions: jest.Mock;
    revokeSession: jest.Mock;
    globalLogout: jest.Mock;
    verifyEmail: jest.Mock;
    resendVerification: jest.Mock;
    forgotPassword: jest.Mock;
    resetPassword: jest.Mock;
  };
  let sessionMapper: {
    toSessionResponse: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      logoutAll: jest.fn(),
      getActiveSessions: jest.fn(),
      revokeSession: jest.fn(),
      globalLogout: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerification: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
    };
    sessionMapper = {
      toSessionResponse: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])],
      controllers: [AuthController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: SessionMapper, useValue: sessionMapper },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const dto = { email: 'test@example.com', password: 'Password1!' };
      const expected = {
        message: 'Registration successful',
        email: 'test@example.com',
      };
      usersService.register.mockResolvedValue(expected);

      const result = await controller.register(dto);

      expect(result).toEqual(expected);
      expect(usersService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should login user and set cookie', async () => {
      const dto = { email: 'test@example.com', password: 'Password1!' };
      const expected = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 900,
        tokenType: 'Bearer',
      };
      usersService.login.mockResolvedValue(expected);

      const req = createMockRequest({
        headers: { 'user-agent': 'Mozilla/5.0' },
      });
      const res = createMockResponse();

      const result = await controller.login(dto, req, res);

      expect(result).toEqual({
        accessToken: 'token',
        expiresIn: 900,
        tokenType: 'Bearer',
      });
      expect(usersService.login).toHaveBeenCalledWith(
        dto,
        '127.0.0.1',
        'Mozilla/5.0',
      );
    });
  });

  describe('refresh', () => {
    it('should refresh token and set new cookie', async () => {
      const expected = {
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        expiresIn: 900,
        tokenType: 'Bearer',
      };
      usersService.refresh.mockResolvedValue(expected);

      const req = createMockRequest({
        cookies: { refresh_token: 'old-refresh-token' },
        headers: { 'user-agent': 'Mozilla/5.0' },
      });
      const res = createMockResponse();

      const result = await controller.refresh(req, res);

      expect(result).toEqual({
        accessToken: 'new-token',
        expiresIn: 900,
        tokenType: 'Bearer',
      });
    });

    it('should throw when no refresh token cookie', async () => {
      const req = createMockRequest({
        cookies: {},
        headers: { 'user-agent': 'Mozilla/5.0' },
      });
      const res = createMockResponse();

      await expect(controller.refresh(req, res)).rejects.toThrow();
    });
  });

  describe('verifyEmail', () => {
    it('should verify email', async () => {
      usersService.verifyEmail.mockResolvedValue(undefined);

      const result = await controller.verifyEmail({
        email: 'test@example.com',
        otp: '123456',
      });

      expect(result).toEqual({ message: 'Email verified successfully' });
      expect(usersService.verifyEmail).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
      );
    });
  });

  describe('resendVerification', () => {
    it('should resend verification', async () => {
      usersService.resendVerification.mockResolvedValue(undefined);

      const result = await controller.resendVerification({
        email: 'test@example.com',
      });

      expect(result).toEqual({
        message:
          'If your email is registered, a verification code has been sent',
      });
      expect(usersService.resendVerification).toHaveBeenCalledWith(
        'test@example.com',
      );
    });
  });

  describe('logout', () => {
    it('should logout current session', async () => {
      usersService.logout.mockResolvedValue(undefined);
      usersService.getActiveSessions.mockResolvedValue([
        { id: 'session-1', refreshTokenHash: 'hashed-token' },
      ]);

      const req = createMockRequest({
        cookies: { refresh_token: 'refresh-token' },
        headers: { 'user-agent': 'Mozilla/5.0' },
      });
      const res = createMockResponse();

      const result = await controller.logout(
        { userId: 'user-1' },
        req,
        res,
      );

      expect(result).toEqual({ message: 'Logged out successfully.' });
    });

    it('should handle missing refresh token cookie', async () => {
      const req = createMockRequest({
        cookies: {},
        headers: { 'user-agent': 'Mozilla/5.0' },
      });
      const res = createMockResponse();

      const result = await controller.logout(
        { userId: 'user-1' },
        req,
        res,
      );

      expect(result).toEqual({ message: 'Logged out successfully.' });
      expect(usersService.logout).not.toHaveBeenCalled();
    });
  });

  describe('logoutAll', () => {
    it('should logout from all devices', async () => {
      usersService.logoutAll.mockResolvedValue(undefined);

      const req = createMockRequest({
        headers: { 'user-agent': 'Mozilla/5.0' },
      });
      const res = createMockResponse();

      const result = await controller.logoutAll(
        { userId: 'user-1' },
        req,
        res,
      );

      expect(result).toEqual({
        message: 'Logged out from all devices successfully.',
      });
      expect(usersService.logoutAll).toHaveBeenCalledWith(
        'user-1',
        '127.0.0.1',
        'Mozilla/5.0',
      );
    });
  });

  describe('getSessions', () => {
    it('should return active sessions', async () => {
      const sessions = [
        {
          id: 'session-1',
          browser: 'Chrome',
          operatingSystem: 'Windows',
          ipAddress: '127.0.0.1',
          createdAt: new Date(),
          lastUsedAt: new Date(),
        },
      ];
      usersService.getActiveSessions.mockResolvedValue(sessions);
      sessionMapper.toSessionResponse.mockReturnValue(sessions[0]);

      const result = await controller.getSessions({ userId: 'user-1' });

      expect(result).toHaveLength(1);
      expect(usersService.getActiveSessions).toHaveBeenCalledWith('user-1');
      expect(sessionMapper.toSessionResponse).toHaveBeenCalled();
    });
  });

  describe('revokeAllSessions', () => {
    it('should revoke all other sessions', async () => {
      usersService.globalLogout.mockResolvedValue(undefined);
      usersService.getActiveSessions.mockResolvedValue([
        { id: 'session-1', refreshTokenHash: 'hashed-token' },
      ]);

      const req = createMockRequest({
        cookies: { refresh_token: 'refresh-token' },
        headers: { 'user-agent': 'Mozilla/5.0' },
      });
      const res = createMockResponse();

      const result = await controller.revokeAllSessions(
        { userId: 'user-1' },
        req,
        res,
      );

      expect(result).toEqual({
        message: 'All other sessions revoked successfully.',
      });
    });
  });

  describe('revokeSession', () => {
    it('should revoke a specific session', async () => {
      usersService.revokeSession.mockResolvedValue(undefined);

      const req = createMockRequest({
        headers: { 'user-agent': 'Mozilla/5.0' },
      });

      const result = await controller.revokeSession(
        { userId: 'user-1' },
        req,
        'session-2',
      );

      expect(result).toEqual({ message: 'Session revoked successfully' });
      expect(usersService.revokeSession).toHaveBeenCalledWith(
        'user-1',
        'session-2',
        '127.0.0.1',
        'Mozilla/5.0',
      );
    });
  });

  describe('forgotPassword', () => {
    it('should call forgot password service', async () => {
      usersService.forgotPassword.mockResolvedValue(undefined);

      const result = await controller.forgotPassword({
        email: 'test@example.com',
      });

      expect(result).toEqual({
        message:
          'If the account exists, password reset instructions have been sent.',
      });
      expect(usersService.forgotPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password', async () => {
      usersService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword({
        email: 'test@example.com',
        otp: '123456',
        newPassword: 'NewPass1!',
      });

      expect(result).toEqual({
        message: 'Password has been reset successfully. Please sign in again.',
      });
      expect(usersService.resetPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        otp: '123456',
        newPassword: 'NewPass1!',
      });
    });
  });
});
