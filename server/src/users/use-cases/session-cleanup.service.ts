import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { USER_CONSTANTS, USER_LOG_MESSAGES } from '../constants/user.constants';
import { SessionRepository } from '../repositories/session.repository';
import { daysAgo } from '../utils/auth.utils';

@Injectable()
export class SessionCleanupService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SessionCleanupService.name);
  }

  async cleanup(): Promise<void> {
    this.logger.info(USER_LOG_MESSAGES.SESSION_CLEANUP_STARTED);

    const retentionDate = daysAgo(
      USER_CONSTANTS.SESSION_CLEANUP_RETENTION_DAYS,
    );

    const [expiredResult, revokedResult] = await Promise.all([
      this.sessionRepository.deleteExpired(),
      this.sessionRepository.deleteRevokedOlderThan(retentionDate),
    ]);

    this.logger.info(
      {
        expiredDeleted: expiredResult.count,
        revokedDeleted: revokedResult.count,
      },
      USER_LOG_MESSAGES.SESSION_CLEANUP_COMPLETED,
    );
  }
}
