import { Test, TestingModule } from '@nestjs/testing';

import { UsersService } from './users.service';
import { UserRegisterService } from '../use-cases/user-register.service';
import { UserLoginService } from '../use-cases/user-login.service';
import { UserProfileService } from '../use-cases/user-profile.service';
import { UserVerifyEmailService } from '../use-cases/user-verify-email.service';
import { UserResendVerificationService } from '../use-cases/user-resend-verification.service';
import { UserChangePasswordService } from '../use-cases/user-change-password.service';
import { UserForgotPasswordService } from '../use-cases/user-forgot-password.service';
import { UserResetPasswordService } from '../use-cases/user-reset-password.service';
import { SessionRepository } from '../repositories/session.repository';

describe('UsersService', () => {
  let service: UsersService;
  let registerService: { register: jest.Mock };
  let loginService: {
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
    getActiveSessions: jest.Mock;
    revokeSession: jest.Mock;
  };
  let profileService: { getProfile: jest.Mock };
  let verifyEmailService: { verify: jest.Mock };
  let resendVerificationService: { resend: jest.Mock };
  let changePasswordService: { changePassword: jest.Mock };
  let forgotPasswordService: { execute: jest.Mock };
  let resetPasswordService: { execute: jest.Mock };
  let sessionRepository: { findActiveByUserId: jest.Mock };

  beforeEach(async () => {
    registerService = { register: jest.fn() };
    loginService = {
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      getActiveSessions: jest.fn(),
      revokeSession: jest.fn(),
    };
    profileService = { getProfile: jest.fn() };
    verifyEmailService = { verify: jest.fn() };
    resendVerificationService = { resend: jest.fn() };
    changePasswordService = { changePassword: jest.fn() };
    forgotPasswordService = { execute: jest.fn() };
    resetPasswordService = { execute: jest.fn() };
    sessionRepository = { findActiveByUserId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UserRegisterService, useValue: registerService },
        { provide: UserLoginService, useValue: loginService },
        { provide: UserProfileService, useValue: profileService },
        { provide: UserVerifyEmailService, useValue: verifyEmailService },
        {
          provide: UserResendVerificationService,
          useValue: resendVerificationService,
        },
        {
          provide: UserChangePasswordService,
          useValue: changePasswordService,
        },
        { provide: UserForgotPasswordService, useValue: forgotPasswordService },
        { provide: UserResetPasswordService, useValue: resetPasswordService },
        { provide: SessionRepository, useValue: sessionRepository },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should call registerService.register', async () => {
      const dto = { email: 'test@example.com', password: 'Password1!' };
      const expected = { accessToken: 'token', refreshToken: 'refresh' };
      registerService.register.mockResolvedValue(expected);

      const result = await service.register(dto);

      expect(result).toEqual(expected);
      expect(registerService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should call loginService.login with ip and userAgent', async () => {
      const dto = { email: 'test@example.com', password: 'Password1!' };
      const ip = '127.0.0.1';
      const userAgent = 'Mozilla/5.0';
      const expected = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 900,
        tokenType: 'Bearer',
      };
      loginService.login.mockResolvedValue(expected);

      const result = await service.login(dto, ip, userAgent);

      expect(result).toEqual(expected);
      expect(loginService.login).toHaveBeenCalledWith(dto, ip, userAgent);
    });
  });

  describe('refresh', () => {
    it('should call loginService.refresh with ip and userAgent', async () => {
      const refreshToken = 'refresh-token';
      const ip = '127.0.0.1';
      const userAgent = 'Mozilla/5.0';
      const expected = {
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        expiresIn: 900,
        tokenType: 'Bearer',
      };
      loginService.refresh.mockResolvedValue(expected);

      const result = await service.refresh(refreshToken, ip, userAgent);

      expect(result).toEqual(expected);
      expect(loginService.refresh).toHaveBeenCalledWith(
        refreshToken,
        ip,
        userAgent,
      );
    });
  });

  describe('logout', () => {
    it('should call loginService.logout', async () => {
      loginService.logout.mockResolvedValue(undefined);

      await service.logout('user-1', 'session-1', '127.0.0.1', 'Mozilla/5.0');

      expect(loginService.logout).toHaveBeenCalledWith(
        'user-1',
        'session-1',
        '127.0.0.1',
        'Mozilla/5.0',
      );
    });
  });

  describe('getActiveSessions', () => {
    it('should call loginService.getActiveSessions', async () => {
      const sessions = [{ id: 'session-1' }];
      loginService.getActiveSessions.mockResolvedValue(sessions);

      const result = await service.getActiveSessions('user-1');

      expect(result).toEqual(sessions);
      expect(loginService.getActiveSessions).toHaveBeenCalledWith('user-1');
    });
  });

  describe('revokeSession', () => {
    it('should call loginService.revokeSession', async () => {
      loginService.revokeSession.mockResolvedValue(undefined);

      await service.revokeSession(
        'user-1',
        'session-1',
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(loginService.revokeSession).toHaveBeenCalledWith(
        'user-1',
        'session-1',
        '127.0.0.1',
        'Mozilla/5.0',
      );
    });
  });

  describe('getProfile', () => {
    it('should call profileService.getProfile', async () => {
      const userId = 'user-1';
      const expected = {
        id: userId,
        email: 'test@example.com',
        emailVerified: true,
        status: 'ACTIVE',
        createdAt: new Date(),
        lastLoginAt: null,
      };
      profileService.getProfile.mockResolvedValue(expected);

      const result = await service.getProfile(userId);

      expect(result).toEqual(expected);
      expect(profileService.getProfile).toHaveBeenCalledWith(userId);
    });
  });

  describe('verifyEmail', () => {
    it('should call verifyEmailService.verify', async () => {
      verifyEmailService.verify.mockResolvedValue(undefined);

      await service.verifyEmail('test@example.com', '123456');

      expect(verifyEmailService.verify).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
      );
    });
  });

  describe('resendVerification', () => {
    it('should call resendVerificationService.resend', async () => {
      resendVerificationService.resend.mockResolvedValue(undefined);

      await service.resendVerification('test@example.com');

      expect(resendVerificationService.resend).toHaveBeenCalledWith(
        'test@example.com',
      );
    });
  });
});
