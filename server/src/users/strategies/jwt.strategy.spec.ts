import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { JwtStrategy } from './jwt.strategy';
import { UserRepository } from '../repositories/user.repository';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const repository = {
    findById: jest.fn(),
  };

  const configService = {
    getOrThrow: jest.fn().mockReturnValue('secret-key'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    configService.getOrThrow.mockReturnValue('secret-key');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: UserRepository, useValue: repository },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return userId if valid', async () => {
      const payload = {
        sub: 'user-1',
        tokenVersion: 0,
        iss: 'tinylink',
        aud: 'tinylink-api',
        jti: 'test-jti',
      };
      const user = {
        id: 'user-1',
        tokenVersion: 0,
        status: 'ACTIVE',
        emailVerified: true,
      };
      repository.findById.mockResolvedValue(user);

      const result = await strategy.validate(payload);

      expect(result).toEqual({ userId: 'user-1' });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const payload = {
        sub: 'nonexistent',
        tokenVersion: 0,
        iss: 'tinylink',
        aud: 'tinylink-api',
        jti: 'test-jti',
      };
      repository.findById.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token version mismatch', async () => {
      const payload = {
        sub: 'user-1',
        tokenVersion: 1,
        iss: 'tinylink',
        aud: 'tinylink-api',
        jti: 'test-jti',
      };
      const user = {
        id: 'user-1',
        tokenVersion: 0,
        status: 'ACTIVE',
        emailVerified: true,
      };
      repository.findById.mockResolvedValue(user);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user status is not ACTIVE', async () => {
      const payload = {
        sub: 'user-1',
        tokenVersion: 0,
        iss: 'tinylink',
        aud: 'tinylink-api',
        jti: 'test-jti',
      };
      const user = {
        id: 'user-1',
        tokenVersion: 0,
        status: 'PENDING_VERIFICATION',
        emailVerified: false,
      };
      repository.findById.mockResolvedValue(user);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if email not verified', async () => {
      const payload = {
        sub: 'user-1',
        tokenVersion: 0,
        iss: 'tinylink',
        aud: 'tinylink-api',
        jti: 'test-jti',
      };
      const user = {
        id: 'user-1',
        tokenVersion: 0,
        status: 'ACTIVE',
        emailVerified: false,
      };
      repository.findById.mockResolvedValue(user);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
