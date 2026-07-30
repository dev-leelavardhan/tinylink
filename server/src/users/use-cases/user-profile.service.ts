import { Injectable, NotFoundException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import {
  USER_ERROR_MESSAGES,
  USER_LOG_MESSAGES,
} from '../constants/user.constants';
import { type UserProfileResponse } from '../mappers/types';
import { UserMapper } from '../mappers/user.mapper';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class UserProfileService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userMapper: UserMapper,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserProfileService.name);
  }

  async getProfile(userId: string): Promise<UserProfileResponse> {
    this.logger.info('Fetching user profile');

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(USER_ERROR_MESSAGES.USER_NOT_FOUND);
    }

    this.logger.info({ userId }, USER_LOG_MESSAGES.PROFILE_FETCHED);

    return this.userMapper.toProfile(user);
  }
}
