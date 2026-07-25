import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthController } from './auth.controller';
import { UsersService } from '../service/users.service';

describe('AuthController', () => {
  let controller: AuthController;
  let usersService: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    verifyEmail: jest.Mock;
    resendVerification: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])],
      controllers: [AuthController],
      providers: [{ provide: UsersService, useValue: usersService }],
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
    it('should login user', async () => {
      const dto = { email: 'test@example.com', password: 'Password1!' };
      const expected = { accessToken: 'token', refreshToken: 'refresh' };
      usersService.login.mockResolvedValue(expected);

      const result = await controller.login(dto);

      expect(result).toEqual(expected);
      expect(usersService.login).toHaveBeenCalledWith(dto);
    });
  });

  describe('refresh', () => {
    it('should refresh token', async () => {
      const dto = { refreshToken: 'refresh-token' };
      const expected = { accessToken: 'new-token' };
      usersService.refresh.mockResolvedValue(expected);

      const result = await controller.refresh(dto);

      expect(result).toEqual(expected);
      expect(usersService.refresh).toHaveBeenCalledWith('refresh-token');
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
