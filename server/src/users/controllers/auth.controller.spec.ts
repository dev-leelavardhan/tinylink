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
    getActiveSessions: jest.Mock;
    revokeSession: jest.Mock;
    verifyEmail: jest.Mock;
    resendVerification: jest.Mock;
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
      getActiveSessions: jest.fn(),
      revokeSession: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerification: jest.fn(),
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
      const expected = { accessToken: 'token', refreshToken: 'refresh' };
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
});
