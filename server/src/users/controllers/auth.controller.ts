import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { type Request, type Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

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
import { UsersService } from '../service/users.service';
import { type AuthTokens } from '../types';
import { type LoginResult } from '../use-cases/user-login.service';
import { SessionMapper } from '../mappers/session.mapper';
import {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
  getClientIp,
  hashRefreshToken,
} from '../utils/auth.utils';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionMapper: SessionMapper,
  ) {}

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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<LoginResult, 'refreshToken'>> {
    const ip = getClientIp(req.headers, req.ip);
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
      throw new Error('Refresh token not found');
    }

    const ip = getClientIp(req.headers, req.ip);
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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const userId = (req.user as { userId: string })?.userId;
    const refreshToken = getRefreshTokenFromCookie(
      req.cookies as Record<string, string>,
    );

    if (refreshToken) {
      const ip = getClientIp(req.headers, req.ip);
      const userAgent = req.headers['user-agent'];

      const refreshTokenHash = hashRefreshToken(refreshToken);

      const session = await this.usersService.getActiveSessions(userId);
      const currentSession = session.find(
        (s) => s.refreshTokenHash === refreshTokenHash,
      );

      if (currentSession) {
        await this.usersService.logout(
          userId,
          currentSession.id,
          ip,
          userAgent,
        );
      }
    }

    clearRefreshTokenCookie(res);

    return { message: 'Logged out successfully' };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getSessions(@Req() req: Request) {
    const userId = (req.user as { userId: string })?.userId;
    const sessions = await this.usersService.getActiveSessions(userId);
    return sessions.map((session) =>
      this.sessionMapper.toSessionResponse(session),
    );
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('sessionId') sessionId: string,
  ): Promise<{ message: string }> {
    const userId = (req.user as { userId: string })?.userId;
    const ip = getClientIp(req.headers, req.ip);
    const userAgent = req.headers['user-agent'];

    await this.usersService.revokeSession(userId, sessionId, ip, userAgent);

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
}
