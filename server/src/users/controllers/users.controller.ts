import { Controller, Get, Request, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { type UserProfileResponse } from '../mappers/types';
import { UsersService } from '../service/users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(
    @Request() req: { user: { userId: string } },
  ): Promise<UserProfileResponse> {
    return this.usersService.getProfile(req.user.userId);
  }
}
