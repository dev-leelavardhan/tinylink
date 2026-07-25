import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PinoLogger } from 'nestjs-pino';

import {
  USER_CONSTANTS,
  USER_ERROR_MESSAGES,
  USER_LOG_MESSAGES,
} from '../constants/user.constants';
import { type LoginUserDto } from '../dto/login-user.dto';
import { UserRepository } from '../repositories/user.repository';
import { type AuthTokens, type JwtPayload } from '../types';

@Injectable()
export class UserLoginService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserLoginService.name);
  }

  async login(dto: LoginUserDto): Promise<AuthTokens> {
    this.logger.info('Starting login');

    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException(USER_ERROR_MESSAGES.LOGIN_FAILED);
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException(USER_ERROR_MESSAGES.LOGIN_FAILED);
    }

    if (user.status === 'PENDING_VERIFICATION') {
      throw new ForbiddenException(
        USER_ERROR_MESSAGES.ACCOUNT_PENDING_VERIFICATION,
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(USER_ERROR_MESSAGES.ACCOUNT_NOT_ACTIVE);
    }

    const updatedUser = await this.userRepository.incrementTokenVersion(
      user.id,
    );

    await this.userRepository.updateLastLogin(user.id);

    this.logger.info({ userId: user.id }, USER_LOG_MESSAGES.LOGIN_SUCCESS);

    return this.generateTokens(user.id, updatedUser.tokenVersion);
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userRepository.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException(USER_ERROR_MESSAGES.USER_NOT_FOUND);
      }

      if (user.tokenVersion !== payload.tokenVersion) {
        throw new UnauthorizedException(USER_ERROR_MESSAGES.TOKEN_REVOKED);
      }

      const updatedUser = await this.userRepository.incrementTokenVersion(
        user.id,
      );

      const accessToken = await this.jwtService.signAsync(
        { sub: user.id, tokenVersion: updatedUser.tokenVersion },
        {
          secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: USER_CONSTANTS.ACCESS_TOKEN_EXPIRY,
        },
      );

      return { accessToken };
    } catch {
      throw new UnauthorizedException(
        USER_ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
      );
    }
  }

  private async generateTokens(
    userId: string,
    tokenVersion: number,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, tokenVersion };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: USER_CONSTANTS.ACCESS_TOKEN_EXPIRY,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: USER_CONSTANTS.REFRESH_TOKEN_EXPIRY,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
