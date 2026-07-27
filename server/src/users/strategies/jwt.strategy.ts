import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import {
  USER_CONSTANTS,
  USER_ERROR_MESSAGES,
} from '../constants/user.constants';
import { UserRepository } from '../repositories/user.repository';
import { type JwtPayload } from '../types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly userRepository: UserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      issuer: USER_CONSTANTS.JWT_ISSUER,
      audience: USER_CONSTANTS.JWT_AUDIENCE,
    });
  }

  async validate(payload: JwtPayload): Promise<{ userId: string }> {
    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException(USER_ERROR_MESSAGES.USER_NOT_FOUND);
    }
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException(USER_ERROR_MESSAGES.TOKEN_REVOKED);
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(USER_ERROR_MESSAGES.ACCOUNT_NOT_ACTIVE);
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException(
        USER_ERROR_MESSAGES.ACCOUNT_PENDING_VERIFICATION,
      );
    }
    return { userId: payload.sub };
  }
}
