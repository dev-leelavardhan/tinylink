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
    get: jest.fn().mockReturnValue(587),
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

  describe('sendMail', () => {
    it('should send an email successfully', async () => {
      await service.sendMail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(logger.info).toHaveBeenCalled();
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
});
