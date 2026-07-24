import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PinoLogger } from 'nestjs-pino';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

import {
  USER_CONSTANTS,
  USER_ERROR_MESSAGES,
  USER_LOG_MESSAGES,
} from '../constants/user.constants';
import { type RegisterUserDto } from '../dto/register-user.dto';
import { UserMapper } from '../mappers/user.mapper';
import { UserRepository } from '../repositories/user.repository';
import { type AuthTokens, type JwtPayload } from '../types';

@Injectable()
export class UserRegisterService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userMapper: UserMapper,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserRegisterService.name);
  }

  async register(dto: RegisterUserDto): Promise<AuthTokens> {
    this.logger.info('Starting registration');

    const passwordHash = await bcrypt.hash(
      dto.password,
      USER_CONSTANTS.BCRYPT_ROUNDS,
    );

    try {
      const user = await this.userRepository.create({
        email: dto.email,
        passwordHash,
      });

      this.logger.info({ userId: user.id }, USER_LOG_MESSAGES.REGISTER_SUCCESS);

      return this.generateTokens(user.id, user.tokenVersion);
    } catch (error: unknown) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(USER_ERROR_MESSAGES.EMAIL_EXISTS);
      }

      this.logger.error({ err: error }, USER_ERROR_MESSAGES.REGISTER_FAILED);
      throw new InternalServerErrorException(
        USER_ERROR_MESSAGES.REGISTER_FAILED,
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
