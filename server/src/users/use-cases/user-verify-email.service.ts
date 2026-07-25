import { BadRequestException, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import {
  USER_ERROR_MESSAGES,
  USER_LOG_MESSAGES,
} from '../constants/user.constants';
import { UserRepository } from '../repositories/user.repository';
import { UserOtpService } from './user-otp.service';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class UserVerifyEmailService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpService: UserOtpService,
    private readonly auditService: AuditService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserVerifyEmailService.name);
  }

  async verify(email: string, otp: string): Promise<void> {
    this.logger.info('Verifying email');

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      // Generic response to prevent email enumeration
      throw new BadRequestException(USER_ERROR_MESSAGES.INVALID_OTP);
    }

    if (user.emailVerified) {
      this.logger.info({ userId: user.id }, 'Email already verified');
      return;
    }

    if (user.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestException(USER_ERROR_MESSAGES.INVALID_OTP);
    }

    const result = await this.otpService.verify(user.id, otp);

    if (!result) {
      await this.auditService.logEmailVerificationFailed(user.id);
      throw new BadRequestException(USER_ERROR_MESSAGES.INVALID_OTP);
    }

    // Update user status
    await this.userRepository.updateStatus(user.id, 'ACTIVE');

    // Mark email as verified
    await this.userRepository.markEmailVerified(user.id);

    this.logger.info({ userId: user.id }, USER_LOG_MESSAGES.OTP_VERIFIED);
    await this.auditService.logEmailVerificationSuccess(user.id);
  }
}
