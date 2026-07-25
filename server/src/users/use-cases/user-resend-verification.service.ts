import { Injectable, NotFoundException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import {
  USER_ERROR_MESSAGES,
  USER_LOG_MESSAGES,
} from '../constants/user.constants';
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
      throw new NotFoundException(USER_ERROR_MESSAGES.USER_NOT_FOUND);
    }

    if (user.emailVerified) {
      this.logger.info({ userId: user.id }, 'Email already verified');
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

    await this.mailerService.sendMail({
      to: email,
      subject: 'Verify your email address',
      html,
    });
  }
}
