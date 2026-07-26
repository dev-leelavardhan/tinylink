import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

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
import { BruteForceService } from './use-cases/brute-force.service';
import { RedisModule } from '../redis/redis.module';
import { MailerModule } from '../mailer/mailer.module';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    RedisModule,
    MailerModule,
    AuditModule,
  ],

  controllers: [AuthController, UsersController],

  providers: [
    // Infrastructure
    JwtStrategy,

    // Application (use-cases)
    UsersService,
    UserRegisterService,
    UserLoginService,
    UserProfileService,
    UserOtpService,
    UserVerifyEmailService,
    UserResendVerificationService,
    BruteForceService,

    // Persistence
    UserRepository,
    SessionRepository,

    // Mapping
    UserMapper,
    SessionMapper,
  ],

  exports: [UsersService, UserRepository, SessionRepository, JwtModule],
})
export class UsersModule {}
