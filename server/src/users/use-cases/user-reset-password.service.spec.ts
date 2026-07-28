import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import * as argon2 from 'argon2';

import { UserResetPasswordService } from './user-reset-password.service';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { UserOtpService } from './user-otp.service';
import { AuditService } from '../../common/audit/audit.service';
import { createLoggerMock } from '../../testing/mocks';

jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));

describe('UserResetPasswordService', () => {
  let service: UserResetPasswordService;

  const userRepository = {
    findByEmail: jest.fn(),
    updatePassword: jest.fn(),
    incrementTokenVersion: jest.fn(),
  };

  const sessionRepository = {
    revokeAllForUser: jest.fn(),
  };

  const otpService = {
    verify: jest.fn(),
    invalidateOldOtps: jest.fn(),
  };

  const auditService = {
    log: jest.fn(),
  };

  const logger = createLoggerMock();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserResetPasswordService,
        { provide: UserRepository, useValue: userRepository },
        { provide: SessionRepository, useValue: sessionRepository },
        { provide: UserOtpService, useValue: otpService },
        { provide: AuditService, useValue: auditService },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(UserResetPasswordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('execute', () => {
    const dto = {
      email: 'test@example.com',
      otp: '123456',
      newPassword: 'NewPass1!',
    };

    it('should reset password successfully', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'old-hash',
      });
      otpService.verify.mockResolvedValue(true);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      (argon2.hash as jest.Mock).mockResolvedValue('new-hash');
      userRepository.updatePassword.mockResolvedValue({});
      userRepository.incrementTokenVersion.mockResolvedValue({
        tokenVersion: 2,
      });
      sessionRepository.revokeAllForUser.mockResolvedValue({ count: 1 });
      otpService.invalidateOldOtps.mockResolvedValue(undefined);

      await service.execute(dto);

      expect(userRepository.updatePassword).toHaveBeenCalledWith(
        'user-1',
        'new-hash',
      );
      expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith('user-1');
      expect(otpService.invalidateOldOtps).toHaveBeenCalledWith('user-1');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'PASSWORD_RESET_COMPLETED' }),
      );
    });

    it('should throw if user not found', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(service.execute(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if OTP is invalid', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'old-hash',
      });
      otpService.verify.mockResolvedValue(null);

      await expect(service.execute(dto)).rejects.toThrow(UnauthorizedException);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'PASSWORD_RESET_FAILED' }),
      );
    });

    it('should throw if new password is same as current', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'old-hash',
      });
      otpService.verify.mockResolvedValue(true);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.execute(dto)).rejects.toThrow(BadRequestException);
    });
  });
});
