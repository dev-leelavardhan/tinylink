import { Injectable } from '@nestjs/common';
import { type User } from '@prisma/client';

import { type UserProfileResponse } from './types';

@Injectable()
export class UserMapper {
  toProfile(user: User): UserProfileResponse {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
