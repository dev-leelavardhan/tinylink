import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PinoLogger } from 'nestjs-pino';

import {
  USER_CONSTANTS,
  USER_ERROR_MESSAGES,
  USER_LOG_MESSAGES,
} from '../constants/user.constants';
import { type ChangePasswordDto } from '../dto/change-password.dto';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class UserChangePasswordService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly auditService: AuditService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserChangePasswordService.name);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<void> {
    this.logger.info({ userId }, 'Starting password change');

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException(USER_ERROR_MESSAGES.USER_NOT_FOUND);
    }

    const passwordValid = await argon2.verify(
      user.passwordHash,
      dto.currentPassword,
    );
    if (!passwordValid) {
      await this.auditService.logPasswordChanged(
        userId,
        { reason: 'invalid_current_password' },
        ip,
        userAgent,
      );

      throw new UnauthorizedException(
        USER_ERROR_MESSAGES.CHANGE_PASSWORD_CURRENT_INVALID,
      );
    }

    const newPasswordHash = await argon2.hash(dto.newPassword, {
      timeCost: USER_CONSTANTS.ARGON2_TIME_COST,
      memoryCost: USER_CONSTANTS.ARGON2_MEMORY_COST,
      parallelism: USER_CONSTANTS.ARGON2_PARALLELISM,
    });

    await this.userRepository.updatePassword(userId, newPasswordHash);

    const updatedUser = await this.userRepository.incrementTokenVersion(userId);

    await this.sessionRepository.revokeAllForUser(userId);

    await this.auditService.logPasswordChanged(
      userId,
      { tokenVersion: updatedUser.tokenVersion },
      ip,
      userAgent,
    );

    this.logger.info({ userId }, USER_LOG_MESSAGES.PASSWORD_CHANGED);
  }
}
