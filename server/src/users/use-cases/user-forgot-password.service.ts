import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { USER_LOG_MESSAGES } from '../constants/user.constants';
import { type ForgotPasswordDto } from '../dto/forgot-password.dto';
import { UserRepository } from '../repositories/user.repository';
import { UserOtpService } from './user-otp.service';
import { MailerService } from '../../mailer/mailer.service';
import { AuditService } from '../../common/audit/audit.service';
import { normalizeEmail } from '../utils/auth.utils';

@Injectable()
export class UserForgotPasswordService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpService: UserOtpService,
    private readonly mailerService: MailerService,
    private readonly auditService: AuditService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserForgotPasswordService.name);
  }

  async execute(dto: ForgotPasswordDto): Promise<void> {
    const email = normalizeEmail(dto.email);

    // Always return success to prevent account enumeration
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      this.logger.info(
        { email },
        'Password reset requested for non-existent account',
      );
      return;
    }

    // Reject for accounts that cannot authenticate with password
    if (user.status === 'DISABLED' || user.status === 'SUSPENDED') {
      this.logger.info(
        { userId: user.id },
        'Password reset rejected for inactive account',
      );
      return;
    }

    // Generate OTP (invalidates previous unused OTPs automatically)
    const otp = await this.otpService.generate(
      user.id,
      email,
      'PASSWORD_RESET',
    );

    // Send password reset email
    try {
      await this.mailerService.sendPasswordResetEmail(email, otp);
    } catch (err: unknown) {
      this.logger.error(
        { err, userId: user.id },
        'Failed to send password reset email',
      );
    }

    await this.auditService.log({
      userId: user.id,
      event: 'PASSWORD_RESET_REQUESTED',
    });

    this.logger.info(
      { userId: user.id },
      USER_LOG_MESSAGES.PASSWORD_RESET_REQUESTED,
    );
  }
}
