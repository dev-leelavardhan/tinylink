import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { MailerService } from './mailer.service';

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

describe('MailerService', () => {
  let service: MailerService;

  const configService = {
    getOrThrow: jest.fn().mockImplementation((key: string) => {
      const config: Record<string, string> = {
        MAILER_HOST: 'smtp.test.com',
        MAILER_USER: 'user@test.com',
        MAILER_PASS: 'pass',
        MAILER_FROM: 'noreply@test.com',
      };
      return config[key] ?? '';
    }),
    get: jest.fn().mockImplementation((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        MAILER_PORT: 587,
        MAILER_SECURE: 'false',
        MAILER_NAME: undefined,
      };
      return key in config ? config[key] : defaultValue;
    }),
  };

  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailerService,
        { provide: ConfigService, useValue: configService },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = module.get(MailerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSmtpSecure', () => {
    it('should return false for "false" value', () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'MAILER_SECURE') return 'false';
          return defaultValue;
        },
      );
      expect(service.getSmtpSecure()).toBe(false);
    });

    it('should return true for "true" value', () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'MAILER_SECURE') return 'true';
          return defaultValue;
        },
      );
      expect(service.getSmtpSecure()).toBe(true);
    });

    it('should return false for undefined', () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'MAILER_SECURE') return undefined;
          return defaultValue;
        },
      );
      expect(service.getSmtpSecure()).toBe(false);
    });
  });

  describe('sendMail', () => {
    it('should send an email successfully', async () => {
      await service.sendMail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        }),
      );
      expect(logger.info).toHaveBeenCalled();
    });

    it('should send email with text body', async () => {
      await service.sendMail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Plain text body',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Plain text body',
        }),
      );
    });

    it('should log error and throw on failure', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

      await expect(
        service.sendMail({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        }),
      ).rejects.toThrow('Failed to send email');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email', async () => {
      await service.sendPasswordResetEmail('user@example.com', '123456');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Reset your password',
        }),
      );
    });

    it('should throw if email sending fails', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

      await expect(
        service.sendPasswordResetEmail('user@example.com', '123456'),
      ).rejects.toThrow('Failed to send email');
    });
  });
});
