import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';

import { UserVerifyEmailService } from './user-verify-email.service';
import { UserRepository } from '../repositories/user.repository';
import { UserOtpService } from './user-otp.service';
import { createLoggerMock } from '../../testing/mocks';
import { AuditService } from '../../common/audit/audit.service';

describe('UserVerifyEmailService', () => {
  let service: UserVerifyEmailService;

  const repository = {
    findByEmail: jest.fn(),
    updateStatus: jest.fn().mockResolvedValue({}),
    markEmailVerified: jest.fn().mockResolvedValue({}),
  };

  const otpService = {
    verify: jest.fn(),
  };

  const auditService = {
    logEmailVerificationSuccess: jest.fn().mockResolvedValue(undefined),
    logEmailVerificationFailed: jest.fn().mockResolvedValue(undefined),
  };

  const logger = createLoggerMock();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserVerifyEmailService,
        { provide: UserRepository, useValue: repository },
        { provide: UserOtpService, useValue: otpService },
        { provide: AuditService, useValue: auditService },
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
      repository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: false,
        status: 'PENDING_VERIFICATION',
      });
      otpService.verify.mockResolvedValue({ email: 'test@example.com' });

      await service.verify('test@example.com', '123456');

      expect(repository.updateStatus).toHaveBeenCalledWith('user-1', 'ACTIVE');
      expect(repository.markEmailVerified).toHaveBeenCalledWith('user-1');
    });

    it('should throw BadRequestException if user not found (prevent email enumeration)', async () => {
      repository.findByEmail.mockResolvedValue(null);

      await expect(
        service.verify('nonexistent@example.com', '123456'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      repository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: false,
        status: 'PENDING_VERIFICATION',
      });
      otpService.verify.mockResolvedValue(null);

      await expect(
        service.verify('test@example.com', '000000'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip if email already verified', async () => {
      repository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
        status: 'ACTIVE',
      });

      await service.verify('test@example.com', '123456');

      expect(otpService.verify).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if account not pending verification', async () => {
      repository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: false,
        status: 'ACTIVE',
      });

      await expect(
        service.verify('test@example.com', '123456'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
