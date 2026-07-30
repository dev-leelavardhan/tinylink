import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { type Request, type Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import { ZodValidationPipe } from '../../common/zod/common.validation';
import { loginUserSchema, type LoginUserDto } from '../dto/login-user.dto';
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
import {
  forgotPasswordSchema,
  type ForgotPasswordDto,
} from '../dto/forgot-password.dto';
import {
  resetPasswordSchema,
  type ResetPasswordDto,
} from '../dto/reset-password.dto';
import { UsersService } from '../service/users.service';
import { type LoginResult } from '../use-cases/user-login.service';
import { SessionMapper } from '../mappers/session.mapper';
import {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
  getClientIp,
  hashRefreshToken,
} from '../utils/auth.utils';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/auth/current-user.decorator';
import { USER_ERROR_MESSAGES } from '../constants/user.constants';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionMapper: SessionMapper,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 requests per hour
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(registerUserSchema))
    dto: RegisterUserDto,
  ): Promise<{ message: string; email: string }> {
    return this.usersService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginUserSchema))
    dto: LoginUserDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<LoginResult, 'refreshToken'>> {
    const ip = getClientIp(req.ip);
    const userAgent = req.headers['user-agent'];

    const result = await this.usersService.login(dto, ip, userAgent);

    setRefreshTokenCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      tokenType: result.tokenType,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<LoginResult, 'refreshToken'>> {
    const refreshToken = getRefreshTokenFromCookie(
      req.cookies as Record<string, string>,
    );
    if (!refreshToken) {
      throw new UnauthorizedException(
        USER_ERROR_MESSAGES.MISSING_REFRESH_TOKEN,
      );
    }

    const ip = getClientIp(req.ip);
    const userAgent = req.headers['user-agent'];

    const result = await this.usersService.refresh(refreshToken, ip, userAgent);

    setRefreshTokenCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      tokenType: result.tokenType,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const refreshToken = getRefreshTokenFromCookie(
      req.cookies as Record<string, string>,
    );

    if (refreshToken) {
      const ip = getClientIp(req.ip);
      const userAgent = req.headers['user-agent'];

      const refreshTokenHash = hashRefreshToken(refreshToken);

      const session = await this.usersService.getActiveSessions(user.userId);
      const currentSession = session.find(
        (s) => s.refreshTokenHash === refreshTokenHash,
      );

      if (currentSession) {
        await this.usersService.logout(
          user.userId,
          currentSession.id,
          ip,
          userAgent,
        );
      }
    }

    clearRefreshTokenCookie(res);

    return { message: 'Logged out successfully.' };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getSessions(@CurrentUser() user: AuthenticatedUser) {
    const sessions = await this.usersService.getActiveSessions(user.userId);
    return sessions.map((session) =>
      this.sessionMapper.toSessionResponse(session),
    );
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeAllSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const ip = getClientIp(req.ip);
    const userAgent = req.headers['user-agent'];

    const refreshToken = getRefreshTokenFromCookie(
      req.cookies as Record<string, string>,
    );

    if (refreshToken) {
      const refreshTokenHash = hashRefreshToken(refreshToken);
      const sessions = await this.usersService.getActiveSessions(user.userId);
      const currentSession = sessions.find(
        (s) => s.refreshTokenHash === refreshTokenHash,
      );

      if (currentSession) {
        await this.usersService.globalLogout(
          user.userId,
          currentSession.id,
          ip,
          userAgent,
        );
      }
    }

    clearRefreshTokenCookie(res);

    return { message: 'All other sessions revoked successfully.' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const ip = getClientIp(req.ip);
    const userAgent = req.headers['user-agent'];

    await this.usersService.logoutAll(user.userId, ip, userAgent);
    clearRefreshTokenCookie(res);

    return { message: 'Logged out from all devices successfully.' };
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
  ): Promise<{ message: string }> {
    const ip = getClientIp(req.ip);
    const userAgent = req.headers['user-agent'];

    await this.usersService.revokeSession(
      user.userId,
      sessionId,
      ip,
      userAgent,
    );

    return { message: 'Session revoked successfully' };
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

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema))
    dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.usersService.forgotPassword(dto);
    return {
      message:
        'If the account exists, password reset instructions have been sent.',
    };
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 requests per hour
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema))
    dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.usersService.resetPassword(dto);
    return {
      message: 'Password has been reset successfully. Please sign in again.',
    };
  }
}
