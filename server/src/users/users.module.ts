import { Module } from '@nestjs/common';

import { AuthModule } from '../common/auth/auth.module';

import { AuthController } from './controllers/auth.controller';
import { UsersController } from './controllers/users.controller';
import { UserMapper } from './mappers/user.mapper';
import { SessionMapper } from './mappers/session.mapper';
import { UserRepository } from './repositories/user.repository';
import { SessionRepository } from './repositories/session.repository';
import { UsersService } from './service/users.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserLoginService } from './use-cases/user-login.service';
import { UserProfileService } from './use-cases/user-profile.service';
import { UserRegisterService } from './use-cases/user-register.service';
import { UserOtpService } from './use-cases/user-otp.service';
import { UserVerifyEmailService } from './use-cases/user-verify-email.service';
import { UserResendVerificationService } from './use-cases/user-resend-verification.service';
import { UserChangePasswordService } from './use-cases/user-change-password.service';
import { UserForgotPasswordService } from './use-cases/user-forgot-password.service';
import { UserResetPasswordService } from './use-cases/user-reset-password.service';
import { SessionCleanupService } from './use-cases/session-cleanup.service';
import { SessionCleanupQueue } from './queue/session-cleanup.queue';
import { SessionCleanupWorker } from './queue/session-cleanup.worker';
import { SessionCleanupScheduler } from './queue/session-cleanup.scheduler';
import { BruteForceService } from './use-cases/brute-force.service';
import { RedisModule } from '../redis/redis.module';
import { MailerModule } from '../mailer/mailer.module';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [AuthModule, RedisModule, MailerModule, AuditModule],

  controllers: [AuthController, UsersController],

  providers: [
    // Infrastructure
    JwtStrategy,
    SessionCleanupQueue,
    SessionCleanupWorker,
    SessionCleanupScheduler,

    // Application (use-cases)
    UsersService,
    UserRegisterService,
    UserLoginService,
    UserProfileService,
    UserOtpService,
    UserVerifyEmailService,
    UserResendVerificationService,
    UserChangePasswordService,
    UserForgotPasswordService,
    UserResetPasswordService,
    SessionCleanupService,
    BruteForceService,

    // Persistence
    UserRepository,
    SessionRepository,

    // Mapping
    UserMapper,
    SessionMapper,
  ],

  exports: [UsersService, UserRepository, SessionRepository, AuthModule],
})
export class UsersModule {}
