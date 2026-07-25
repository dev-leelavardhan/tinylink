import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';

import { UserLoginService } from './user-login.service';
import { UserRepository } from '../repositories/user.repository';
import { createLoggerMock } from '../../testing/mocks';

jest.mock('argon2', () => ({
  verify: jest.fn(),
}));

describe('UserLoginService', () => {
  let service: UserLoginService;

  const repository = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updateLastLogin: jest.fn(),
    incrementTokenVersion: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('jwt-token'),
    verify: jest.fn(),
  };

  const configService = {
    getOrThrow: jest.fn().mockReturnValue('secret-key'),
  };

  const logger = createLoggerMock();

  beforeEach(async () => {
    jest.clearAllMocks();
    jwtService.signAsync.mockResolvedValue('jwt-token');
    configService.getOrThrow.mockReturnValue('secret-key');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserLoginService,
        { provide: UserRepository, useValue: repository },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
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

    it('should login successfully and revoke old tokens', async () => {
      const user = {
        id: 'user-1',
        email: dto.email,
        passwordHash: 'hashed-password',
        status: 'ACTIVE',
        tokenVersion: 0,
      };
      repository.findByEmail.mockResolvedValue(user);
      repository.incrementTokenVersion.mockResolvedValue({
        ...user,
        tokenVersion: 1,
      });

      const argon2 = jest.requireMock<typeof import('argon2')>('argon2');
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login(dto);

      expect(result).toEqual({
        accessToken: 'jwt-token',
        refreshToken: 'jwt-token',
      });
      expect(repository.incrementTokenVersion).toHaveBeenCalledWith('user-1');
      expect(repository.updateLastLogin).toHaveBeenCalledWith('user-1');
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      repository.findByEmail.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const user = {
        id: 'user-1',
        email: dto.email,
        passwordHash: 'hashed-password',
        status: 'ACTIVE',
        tokenVersion: 0,
      };
      repository.findByEmail.mockResolvedValue(user);

      const argon2 = jest.requireMock<typeof import('argon2')>('argon2');
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException for inactive account', async () => {
      const user = {
        id: 'user-1',
        email: dto.email,
        passwordHash: 'hashed-password',
        status: 'DISABLED',
        tokenVersion: 0,
      };
      repository.findByEmail.mockResolvedValue(user);

      const argon2 = jest.requireMock<typeof import('argon2')>('argon2');
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.login(dto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for pending verification', async () => {
      const user = {
        id: 'user-1',
        email: dto.email,
        passwordHash: 'hashed-password',
        status: 'PENDING_VERIFICATION',
        tokenVersion: 0,
      };
      repository.findByEmail.mockResolvedValue(user);

      const argon2 = jest.requireMock<typeof import('argon2')>('argon2');
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.login(dto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refresh', () => {
    it('should refresh token successfully and revoke old tokens', async () => {
      const payload = { sub: 'user-1', tokenVersion: 0 };
      jwtService.verify.mockReturnValue(payload);

      const user = { id: 'user-1', tokenVersion: 0 };
      repository.findById.mockResolvedValue(user);
      repository.incrementTokenVersion.mockResolvedValue({
        ...user,
        tokenVersion: 1,
      });

      const result = await service.refresh('refresh-token');

      expect(result).toEqual({ accessToken: 'jwt-token' });
      expect(repository.incrementTokenVersion).toHaveBeenCalledWith('user-1');
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refresh('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      const payload = { sub: 'user-1', tokenVersion: 1 };
      jwtService.verify.mockReturnValue(payload);

      const user = { id: 'user-1', tokenVersion: 0 };
      repository.findById.mockResolvedValue(user);

      await expect(service.refresh('refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
