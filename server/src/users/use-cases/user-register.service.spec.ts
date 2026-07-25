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
import { UserOtpService } from './user-otp.service';
import { MailerService } from '../../mailer/mailer.service';
import { createLoggerMock } from '../../testing/mocks';

jest.mock('argon2', () => ({
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

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('jwt-token'),
  };

  const configService = {
    getOrThrow: jest.fn().mockReturnValue('secret-key'),
  };

  const otpService = {
    generate: jest.fn().mockResolvedValue('123456'),
    verify: jest.fn(),
  };

  const mailerService = {
    sendMail: jest.fn().mockResolvedValue(undefined),
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
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: UserOtpService, useValue: otpService },
        { provide: MailerService, useValue: mailerService },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(UserRegisterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const dto = { email: 'test@example.com', password: 'Password1!' };

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
        status: 'PENDING_VERIFICATION',
      });
      expect(otpService.generate).toHaveBeenCalledWith('user-1', dto.email);
      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: dto.email,
        subject: 'Verify your email address',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        html: expect.stringContaining('123456'),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        text: expect.stringContaining('123456'),
      });
    });

    it('should still return tokens if OTP generation fails', async () => {
      const createdUser = {
        id: 'user-1',
        email: dto.email,
        tokenVersion: 0,
      };
      repository.create.mockResolvedValue(createdUser);
      otpService.generate.mockRejectedValueOnce(new Error('Redis down'));

      const result = await service.register(dto);

      expect(result).toEqual({
        accessToken: 'jwt-token',
        refreshToken: 'jwt-token',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should still return tokens if email send fails', async () => {
      const createdUser = {
        id: 'user-1',
        email: dto.email,
        tokenVersion: 0,
      };
      repository.create.mockResolvedValue(createdUser);
      mailerService.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

      const result = await service.register(dto);

      expect(result).toEqual({
        accessToken: 'jwt-token',
        refreshToken: 'jwt-token',
      });
      expect(logger.error).toHaveBeenCalled();
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
