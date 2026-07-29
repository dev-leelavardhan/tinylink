import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { USER_LOG_MESSAGES } from '../constants/user.constants';
import { UserRepository } from '../repositories/user.repository';
import { UserOtpService } from './user-otp.service';
import { MailerService } from '../../mailer/mailer.service';

@Injectable()
export class UserResendVerificationService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpService: UserOtpService,
    private readonly mailerService: MailerService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserResendVerificationService.name);
  }

  async resend(email: string): Promise<void> {
    this.logger.info({ email }, 'Resending verification email');

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      // Generic response to prevent email enumeration
      this.logger.info('Resend verification requested for non-existent email');
      return;
    }

    if (user.emailVerified) {
      this.logger.info({ userId: user.id }, 'Email already verified');
      return;
    }

    if (user.status === 'DISABLED' || user.status === 'SUSPENDED') {
      this.logger.info(
        { userId: user.id },
        'Resend verification rejected for inactive account',
      );
      return;
    }

    // Invalidate old OTPs and generate new one
    const otp = await this.otpService.resend(user.id, user.email);

    if (!otp) {
      this.logger.warn(
        { userId: user.id },
        'OTP resend blocked (rate limit or cooldown)',
      );
      return;
    }

    // Send email
    await this.sendVerificationEmail(user.email, otp);

    this.logger.info({ userId: user.id }, USER_LOG_MESSAGES.OTP_RESEND_SUCCESS);
  }

  private async sendVerificationEmail(
    email: string,
    otp: string,
  ): Promise<void> {
    const html = `
      <h1>Verify your email</h1>
      <p>Your verification code is:</p>
      <h2>${otp}</h2>
      <p>This code expires in 10 minutes.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `;

    const text = [
      'Verify your email',
      '',
      `Your verification code is: ${otp}`,
      '',
      'This code expires in 10 minutes.',
      '',
      "If you didn't request this, you can safely ignore this email.",
    ].join('\n');

    await this.mailerService.sendMail({
      to: email,
      subject: 'Verify your email address',
      html,
      text,
    });
  }
}
