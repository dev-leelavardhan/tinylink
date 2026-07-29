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

    const port = this.config.get<number>(
      'MAILER_PORT',
      MAILER_CONSTANTS.DEFAULT_PORT,
    );
    const secure = this.getSmtpSecure();
    this.assertSecureTransport(port, secure);

    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('MAILER_HOST'),
      port,
      secure,
      auth: {
        user: this.config.getOrThrow<string>('MAILER_USER'),
        pass: this.config.getOrThrow<string>('MAILER_PASS'),
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 5000, // 5 seconds
      socketTimeout: 10000, // 10 seconds
    });
  }

  getSmtpSecure(): boolean {
    const secureFromEnv = this.config.get<string>('MAILER_SECURE');
    if (secureFromEnv === undefined) return false;
    return secureFromEnv !== 'false';
  }

  /**
   * Guard against sending SMTP credentials over an unencrypted transport.
   * Port 465 requires implicit TLS (secure=true) — a hard error. Any other
   * non-STARTTLS-implied port without secure mode is flagged in production.
   */
  private assertSecureTransport(port: number, secure: boolean): void {
    if (port === 465 && !secure) {
      throw new Error(
        'MAILER_SECURE must be true when MAILER_PORT=465 (implicit TLS).',
      );
    }

    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    if (isProduction && !secure && port !== 587) {
      this.logger.warn(
        { port },
        'SMTP is configured without TLS (MAILER_SECURE=false) on a non-587 port; verify credentials are not sent in cleartext.',
      );
    }
  }

  private getFromAddress(): string {
    const from = this.config.getOrThrow<string>('MAILER_FROM');
    const name = this.config.get<string>('MAILER_NAME');

    if (name) {
      return `"${name}" <${from}>`;
    }

    return from;
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    this.logger.info(
      { to: options.to, subject: options.subject },
      MAILER_LOG_MESSAGES.SEND_STARTED,
    );

    try {
      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
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

  async sendPasswordResetEmail(email: string, otp: string): Promise<void> {
    const subject = 'Reset your password';
    const html = `
      <h1>Password Reset Request</h1>
      <p>You requested to reset your password. Use the following code:</p>
      <h2 style="font-size: 32px; letter-spacing: 8px; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px;">${otp}</h2>
      <p>This code will expire in 10 minutes.</p>
      <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
    `;
    const text = `Your password reset code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this, please ignore this email.`;

    await this.sendMail({ to: email, subject, html, text });
  }
}
