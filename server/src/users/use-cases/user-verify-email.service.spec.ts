import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';

import { UserVerifyEmailService } from './user-verify-email.service';
import { UserRepository } from '../repositories/user.repository';
import { UserOtpService } from './user-otp.service';
import { createLoggerMock } from '../../testing/mocks';

describe('UserVerifyEmailService', () => {
  let service: UserVerifyEmailService;

  const repository = {
    findById: jest.fn(),
    updateStatus: jest.fn().mockResolvedValue({}),
    markEmailVerified: jest.fn().mockResolvedValue({}),
  };

  const otpService = {
    verify: jest.fn(),
  };

  const logger = createLoggerMock();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserVerifyEmailService,
        { provide: UserRepository, useValue: repository },
        { provide: UserOtpService, useValue: otpService },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(UserVerifyEmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verify', () => {
    it('should verify email successfully', async () => {
      repository.findById.mockResolvedValue({
        id: 'user-1',
        emailVerified: false,
      });
      otpService.verify.mockResolvedValue({ email: 'test@example.com' });

      await service.verify('user-1', '123456');

      expect(repository.updateStatus).toHaveBeenCalledWith('user-1', 'ACTIVE');
      expect(repository.markEmailVerified).toHaveBeenCalledWith('user-1');
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.verify('user-1', '123456')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      repository.findById.mockResolvedValue({
        id: 'user-1',
        emailVerified: false,
      });
      otpService.verify.mockResolvedValue(null);

      await expect(service.verify('user-1', '000000')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should skip if email already verified', async () => {
      repository.findById.mockResolvedValue({
        id: 'user-1',
        emailVerified: true,
      });

      await service.verify('user-1', '123456');

      expect(otpService.verify).not.toHaveBeenCalled();
    });
  });
});
