import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PinoLogger } from 'nestjs-pino';

import {
  MAILER_CONSTANTS,
  MAILER_ERROR_MESSAGES,
  MAILER_LOG_MESSAGES,
} from './constants/mailer.constants';
import { type SendMailOptions } from './types';

@Injectable()
export class MailerService {
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MailerService.name);

    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('MAILER_HOST'),
      port: this.config.get<number>(
        'MAILER_PORT',
        MAILER_CONSTANTS.DEFAULT_PORT,
      ),
      secure: this.getSmtpSecure(),
      auth: {
        user: this.config.getOrThrow<string>('MAILER_USER'),
        pass: this.config.getOrThrow<string>('MAILER_PASS'),
      },
    });
  }

  getSmtpSecure(): boolean {
    const secureFromEnv = this.config.get<string>('MAILER_SECURE');
    if (secureFromEnv === undefined) return false;
    return secureFromEnv !== 'false';
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    this.logger.info(
      { to: options.to, subject: options.subject },
      MAILER_LOG_MESSAGES.SEND_STARTED,
    );

    try {
      await this.transporter.sendMail({
        from: this.config.getOrThrow<string>('MAILER_FROM'),
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      this.logger.info({ to: options.to }, MAILER_LOG_MESSAGES.SEND_COMPLETED);
    } catch (err: unknown) {
      this.logger.error(
        { err, to: options.to },
        MAILER_LOG_MESSAGES.SEND_FAILED,
      );
      throw new Error(MAILER_ERROR_MESSAGES.SEND_FAILED);
    }
  }
}
