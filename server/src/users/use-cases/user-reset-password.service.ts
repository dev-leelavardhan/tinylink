import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PinoLogger } from 'nestjs-pino';

import {
  USER_CONSTANTS,
  USER_ERROR_MESSAGES,
  USER_LOG_MESSAGES,
} from '../constants/user.constants';
import { type ResetPasswordDto } from '../dto/reset-password.dto';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { UserOtpService } from './user-otp.service';
import { AuditService } from '../../common/audit/audit.service';
import { normalizeEmail } from '../utils/auth.utils';

@Injectable()
export class UserResetPasswordService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly otpService: UserOtpService,
    private readonly auditService: AuditService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserResetPasswordService.name);
  }

  async execute(dto: ResetPasswordDto): Promise<void> {
    const email = normalizeEmail(dto.email);

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException(
        USER_ERROR_MESSAGES.INVALID_PASSWORD_RESET_CODE,
      );
    }

    // Verify OTP
    const result = await this.otpService.verify(
      user.id,
      dto.otp,
      'PASSWORD_RESET',
    );

    if (!result) {
      await this.auditService.log({
        userId: user.id,
        event: 'PASSWORD_RESET_FAILED',
        metadata: { reason: 'invalid_otp' },
      });
      throw new UnauthorizedException(
        USER_ERROR_MESSAGES.INVALID_PASSWORD_RESET_CODE,
      );
    }

    // Check password reuse
    const isSamePassword = await argon2.verify(
      user.passwordHash,
      dto.newPassword,
    );
    if (isSamePassword) {
      throw new BadRequestException(USER_ERROR_MESSAGES.CHANGE_PASSWORD_REUSE);
    }

    // Hash and update password
    const newPasswordHash = await argon2.hash(dto.newPassword, {
      timeCost: USER_CONSTANTS.ARGON2_TIME_COST,
      memoryCost: USER_CONSTANTS.ARGON2_MEMORY_COST,
      parallelism: USER_CONSTANTS.ARGON2_PARALLELISM,
    });

    await this.userRepository.updatePassword(user.id, newPasswordHash);

    // A valid PASSWORD_RESET OTP proves the user controls the email address, so
    // treat a reset for a still-unverified account as email verification and
    // activate it. Without this the account could reset its password yet remain
    // stuck in PENDING_VERIFICATION and unable to log in.
    if (user.status === 'PENDING_VERIFICATION') {
      await this.userRepository.activateAndVerify(user.id);
    }

    // Invalidate existing authentication
    const updatedUser = await this.userRepository.incrementTokenVersion(
      user.id,
    );

    // Revoke all sessions
    await this.sessionRepository.revokeAllForUser(user.id);

    // Invalidate any remaining password reset OTPs
    await this.otpService.invalidateOldOtps(user.id);

    await this.auditService.log({
      userId: user.id,
      event: 'PASSWORD_RESET_COMPLETED',
      metadata: { tokenVersion: updatedUser.tokenVersion },
    });

    this.logger.info(
      { userId: user.id },
      USER_LOG_MESSAGES.PASSWORD_RESET_COMPLETED,
    );
  }
}
