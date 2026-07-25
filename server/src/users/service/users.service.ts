import { Injectable } from '@nestjs/common';

import { type LoginUserDto } from '../dto/login-user.dto';
import { type RegisterUserDto } from '../dto/register-user.dto';
import { type UserProfileResponse } from '../mappers/types';
import { type AuthTokens } from '../types';
import { UserLoginService } from '../use-cases/user-login.service';
import { UserProfileService } from '../use-cases/user-profile.service';
import { UserRegisterService } from '../use-cases/user-register.service';
import { UserVerifyEmailService } from '../use-cases/user-verify-email.service';
import { UserResendVerificationService } from '../use-cases/user-resend-verification.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly registerService: UserRegisterService,
    private readonly loginService: UserLoginService,
    private readonly profileService: UserProfileService,
    private readonly verifyEmailService: UserVerifyEmailService,
    private readonly resendVerificationService: UserResendVerificationService,
  ) {}

  register(dto: RegisterUserDto): Promise<AuthTokens> {
    return this.registerService.register(dto);
  }

  login(dto: LoginUserDto): Promise<AuthTokens> {
    return this.loginService.login(dto);
  }

  refresh(refreshToken: string): Promise<{ accessToken: string }> {
    return this.loginService.refresh(refreshToken);
  }

  getProfile(userId: string): Promise<UserProfileResponse> {
    return this.profileService.getProfile(userId);
  }

  verifyEmail(userId: string, otp: string): Promise<void> {
    return this.verifyEmailService.verify(userId, otp);
  }

  resendVerification(email: string): Promise<void> {
    return this.resendVerificationService.resend(email);
  }
}
