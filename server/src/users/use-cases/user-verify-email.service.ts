import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import {
  USER_ERROR_MESSAGES,
  USER_LOG_MESSAGES,
} from '../constants/user.constants';
import { UserRepository } from '../repositories/user.repository';
import { UserOtpService } from './user-otp.service';

@Injectable()
export class UserVerifyEmailService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpService: UserOtpService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserVerifyEmailService.name);
  }

  async verify(userId: string, otp: string): Promise<void> {
    this.logger.info({ userId }, 'Verifying email');

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException(USER_ERROR_MESSAGES.USER_NOT_FOUND);
    }

    if (user.emailVerified) {
      this.logger.info({ userId }, 'Email already verified');
      return;
    }

    const result = await this.otpService.verify(userId, otp);

    if (!result) {
      throw new BadRequestException(USER_ERROR_MESSAGES.INVALID_OTP);
    }

    // Update user status
    await this.userRepository.updateStatus(userId, 'ACTIVE');

    // Mark email as verified
    await this.userRepository.markEmailVerified(userId);

    this.logger.info({ userId }, USER_LOG_MESSAGES.OTP_VERIFIED);
  }
}
