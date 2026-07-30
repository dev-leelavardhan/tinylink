import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';

import { UserForgotPasswordService } from './user-forgot-password.service';
import { UserRepository } from '../repositories/user.repository';
import { UserOtpService } from './user-otp.service';
import { MailerService } from '../../mailer/mailer.service';
import { AuditService } from '../../common/audit/audit.service';
import { createLoggerMock } from '../../testing/mocks';

describe('UserForgotPasswordService', () => {
  let service: UserForgotPasswordService;

  const userRepository = {
    findByEmail: jest.fn(),
  };

  const otpService = {
    generate: jest.fn(),
  };

  const mailerService = {
    sendPasswordResetEmail: jest.fn(),
  };

  const auditService = {
    log: jest.fn(),
  };

  const logger = createLoggerMock();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserForgotPasswordService,
        { provide: UserRepository, useValue: userRepository },
        { provide: UserOtpService, useValue: otpService },
        { provide: MailerService, useValue: mailerService },
        { provide: AuditService, useValue: auditService },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(UserForgotPasswordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('execute', () => {
    it('should send password reset email for valid user', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        status: 'ACTIVE',
      });
      otpService.generate.mockResolvedValue('123456');
      mailerService.sendPasswordResetEmail.mockResolvedValue(undefined);

      await service.execute({ email: 'test@example.com' });

      expect(otpService.generate).toHaveBeenCalledWith(
        'user-1',
        'test@example.com',
        'PASSWORD_RESET',
      );
      expect(mailerService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
      );
      expect(auditService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        event: 'PASSWORD_RESET_REQUESTED',
      });
    });

    it('should not reveal non-existent user', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await service.execute({ email: 'nonexistent@example.com' });

      expect(otpService.generate).not.toHaveBeenCalled();
      expect(mailerService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should reject for DISABLED accounts', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        status: 'DISABLED',
      });

      await service.execute({ email: 'test@example.com' });

      expect(otpService.generate).not.toHaveBeenCalled();
      expect(mailerService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should reject for SUSPENDED accounts', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        status: 'SUSPENDED',
      });

      await service.execute({ email: 'test@example.com' });

      expect(otpService.generate).not.toHaveBeenCalled();
    });

    it('should not throw if email sending fails', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        status: 'ACTIVE',
      });
      otpService.generate.mockResolvedValue('123456');
      mailerService.sendPasswordResetEmail.mockRejectedValue(
        new Error('SMTP error'),
      );

      await expect(
        service.execute({ email: 'test@example.com' }),
      ).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalled();
    });
  });
});
