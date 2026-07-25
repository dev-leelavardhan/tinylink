import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';

import { UserResendVerificationService } from './user-resend-verification.service';
import { UserRepository } from '../repositories/user.repository';
import { UserOtpService } from './user-otp.service';
import { MailerService } from '../../mailer/mailer.service';
import { createLoggerMock } from '../../testing/mocks';
import { AuditService } from '../../common/audit/audit.service';

describe('UserResendVerificationService', () => {
  let service: UserResendVerificationService;

  const repository = {
    findByEmail: jest.fn(),
  };

  const otpService = {
    resend: jest.fn(),
  };

  const mailerService = {
    sendMail: jest.fn().mockResolvedValue(undefined),
  };

  const auditService = {
    logOtpResent: jest.fn().mockResolvedValue(undefined),
  };

  const logger = createLoggerMock();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserResendVerificationService,
        { provide: UserRepository, useValue: repository },
        { provide: UserOtpService, useValue: otpService },
        { provide: MailerService, useValue: mailerService },
        { provide: AuditService, useValue: auditService },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(UserResendVerificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resend', () => {
    it('should resend verification email', async () => {
      repository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: false,
      });
      otpService.resend.mockResolvedValue('123456');

      await service.resend('test@example.com');

      expect(otpService.resend).toHaveBeenCalledWith(
        'user-1',
        'test@example.com',
      );
      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Verify your email address',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        html: expect.stringContaining('123456'),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        text: expect.stringContaining('123456'),
      });
    });

    it('should return silently if user not found (prevent email enumeration)', async () => {
      repository.findByEmail.mockResolvedValue(null);

      await expect(
        service.resend('nonexistent@example.com'),
      ).resolves.toBeUndefined();

      expect(otpService.resend).not.toHaveBeenCalled();
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('should skip if email already verified', async () => {
      repository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
      });

      await service.resend('test@example.com');

      expect(otpService.resend).not.toHaveBeenCalled();
    });

    it('should handle OTP resend blocked (rate limit)', async () => {
      repository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: false,
      });
      otpService.resend.mockResolvedValue(null);

      await service.resend('test@example.com');

      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });
  });
});
