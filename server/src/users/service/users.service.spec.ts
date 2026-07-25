import { Test, TestingModule } from '@nestjs/testing';

import { UsersService } from './users.service';
import { UserRegisterService } from '../use-cases/user-register.service';
import { UserLoginService } from '../use-cases/user-login.service';
import { UserProfileService } from '../use-cases/user-profile.service';
import { UserVerifyEmailService } from '../use-cases/user-verify-email.service';
import { UserResendVerificationService } from '../use-cases/user-resend-verification.service';

describe('UsersService', () => {
  let service: UsersService;
  let registerService: { register: jest.Mock };
  let loginService: { login: jest.Mock; refresh: jest.Mock };
  let profileService: { getProfile: jest.Mock };
  let verifyEmailService: { verify: jest.Mock };
  let resendVerificationService: { resend: jest.Mock };

  beforeEach(async () => {
    registerService = { register: jest.fn() };
    loginService = { login: jest.fn(), refresh: jest.fn() };
    profileService = { getProfile: jest.fn() };
    verifyEmailService = { verify: jest.fn() };
    resendVerificationService = { resend: jest.fn() };

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
    it('should call loginService.login', async () => {
      const dto = { email: 'test@example.com', password: 'Password1!' };
      const expected = { accessToken: 'token', refreshToken: 'refresh' };
      loginService.login.mockResolvedValue(expected);

      const result = await service.login(dto);

      expect(result).toEqual(expected);
      expect(loginService.login).toHaveBeenCalledWith(dto);
    });
  });

  describe('refresh', () => {
    it('should call loginService.refresh', async () => {
      const refreshToken = 'refresh-token';
      const expected = { accessToken: 'new-token' };
      loginService.refresh.mockResolvedValue(expected);

      const result = await service.refresh(refreshToken);

      expect(result).toEqual(expected);
      expect(loginService.refresh).toHaveBeenCalledWith(refreshToken);
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
