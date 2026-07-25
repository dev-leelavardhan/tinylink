import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { ZodValidationPipe } from '../../common/zod/common.validation';
import { loginUserSchema, type LoginUserDto } from '../dto/login-user.dto';
import {
  refreshTokenSchema,
  type RefreshTokenDto,
} from '../dto/refresh-token.dto';
import {
  registerUserSchema,
  type RegisterUserDto,
} from '../dto/register-user.dto';
import {
  resendVerificationSchema,
  type ResendVerificationDto,
} from '../dto/resend-verification.dto';
import {
  verifyEmailSchema,
  type VerifyEmailDto,
} from '../dto/verify-email.dto';
import { UsersService } from '../service/users.service';
import { type AuthTokens } from '../types';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(registerUserSchema))
    dto: RegisterUserDto,
  ): Promise<AuthTokens> {
    return this.usersService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginUserSchema))
    dto: LoginUserDto,
  ): Promise<AuthTokens> {
    return this.usersService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(refreshTokenSchema))
    dto: RefreshTokenDto,
  ): Promise<{ accessToken: string }> {
    return this.usersService.refresh(dto.refreshToken);
  }

  @Post('verify-email')
  @Throttle({ default: { limit: 5, ttl: 600000 } }) // 5 requests per 10 minutes
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema))
    dto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    await this.usersService.verifyEmail(dto.email, dto.otp);
    return { message: 'Email verified successfully' };
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @Body(new ZodValidationPipe(resendVerificationSchema))
    dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    await this.usersService.resendVerification(dto.email);
    return {
      message: 'If your email is registered, a verification code has been sent',
    };
  }
}
