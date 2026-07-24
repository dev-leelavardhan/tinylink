import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PinoLogger } from 'nestjs-pino';

import { UserRegisterService } from './user-register.service';
import { UserRepository } from '../repositories/user.repository';
import { UserMapper } from '../mappers/user.mapper';
import { createLoggerMock } from '../../testing/mocks';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('UserRegisterService', () => {
  let service: UserRegisterService;

  const repository = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updateLastLogin: jest.fn(),
    incrementTokenVersion: jest.fn(),
  };

  const mapper = {
    toProfile: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('jwt-token'),
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
        UserRegisterService,
        { provide: UserRepository, useValue: repository },
        { provide: UserMapper, useValue: mapper },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(UserRegisterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const dto = { email: 'test@example.com', password: 'password123' };

    it('should register a new user and return tokens', async () => {
      const createdUser = {
        id: 'user-1',
        email: dto.email,
        tokenVersion: 0,
      };
      repository.create.mockResolvedValue(createdUser);

      const result = await service.register(dto);

      expect(result).toEqual({
        accessToken: 'jwt-token',
        refreshToken: 'jwt-token',
      });
      expect(repository.create).toHaveBeenCalledWith({
        email: dto.email,
        passwordHash: 'hashed-password',
      });
    });

    it('should throw ConflictException for duplicate email', async () => {
      const error = new PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { target: ['email'] },
      });
      repository.create.mockRejectedValue(error);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException for other errors', async () => {
      repository.create.mockRejectedValue(new Error('Database error'));

      await expect(service.register(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
