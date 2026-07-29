import { Injectable } from '@nestjs/common';

import { type LoginUserDto } from '../dto/login-user.dto';
import { type RegisterUserDto } from '../dto/register-user.dto';
import { type ChangePasswordDto } from '../dto/change-password.dto';
import { type ForgotPasswordDto } from '../dto/forgot-password.dto';
import { type ResetPasswordDto } from '../dto/reset-password.dto';
import { type UserProfileResponse } from '../mappers/types';
import {
  UserLoginService,
  type LoginResult,
} from '../use-cases/user-login.service';
import { UserProfileService } from '../use-cases/user-profile.service';
import { UserRegisterService } from '../use-cases/user-register.service';
import { UserVerifyEmailService } from '../use-cases/user-verify-email.service';
import { UserResendVerificationService } from '../use-cases/user-resend-verification.service';
import { UserChangePasswordService } from '../use-cases/user-change-password.service';
import { UserForgotPasswordService } from '../use-cases/user-forgot-password.service';
import { UserResetPasswordService } from '../use-cases/user-reset-password.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly registerService: UserRegisterService,
    private readonly loginService: UserLoginService,
    private readonly profileService: UserProfileService,
    private readonly verifyEmailService: UserVerifyEmailService,
    private readonly resendVerificationService: UserResendVerificationService,
    private readonly changePasswordService: UserChangePasswordService,
    private readonly forgotPasswordService: UserForgotPasswordService,
    private readonly resetPasswordService: UserResetPasswordService,
  ) {}

  register(dto: RegisterUserDto): Promise<{ message: string; email: string }> {
    return this.registerService.register(dto);
  }

  login(
    dto: LoginUserDto,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<LoginResult> {
    return this.loginService.login(dto, ip, userAgent);
  }

  refresh(
    refreshToken: string,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<LoginResult> {
    return this.loginService.refresh(refreshToken, ip, userAgent);
  }

  logout(
    userId: string,
    sessionId: string,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<void> {
    return this.loginService.logout(userId, sessionId, ip, userAgent);
  }

  getActiveSessions(userId: string) {
    return this.loginService.getActiveSessions(userId);
  }

  revokeSession(
    userId: string,
    sessionId: string,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<void> {
    return this.loginService.revokeSession(userId, sessionId, ip, userAgent);
  }

  globalLogout(
    userId: string,
    currentSessionId: string,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<void> {
    return this.loginService.globalLogout(
      userId,
      currentSessionId,
      ip,
      userAgent,
    );
  }

  logoutAll(
    userId: string,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<void> {
    return this.loginService.logoutAll(userId, ip, userAgent);
  }

  getProfile(userId: string): Promise<UserProfileResponse> {
    return this.profileService.getProfile(userId);
  }

  changePassword(
    userId: string,
    dto: ChangePasswordDto,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<void> {
    return this.changePasswordService.changePassword(
      userId,
      dto,
      ip,
      userAgent,
    );
  }

  verifyEmail(email: string, otp: string): Promise<void> {
    return this.verifyEmailService.verify(email, otp);
  }

  resendVerification(email: string): Promise<void> {
    return this.resendVerificationService.resend(email);
  }

  forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    return this.forgotPasswordService.execute(dto);
  }

  resetPassword(dto: ResetPasswordDto): Promise<void> {
    return this.resetPasswordService.execute(dto);
  }
}
