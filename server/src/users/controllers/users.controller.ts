import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { type Request } from 'express';

import { ZodValidationPipe } from '../../common/zod/common.validation';
import {
  changePasswordSchema,
  type ChangePasswordDto,
} from '../dto/change-password.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/auth/current-user.decorator';
import { type UserProfileResponse } from '../mappers/types';
import { UsersService } from '../service/users.service';
import { getClientIp } from '../utils/auth.utils';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserProfileResponse> {
    return this.usersService.getProfile(user.userId);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body(new ZodValidationPipe(changePasswordSchema))
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const ip = getClientIp(req.headers, req.ip);
    const userAgent = req.headers['user-agent'];

    await this.usersService.changePassword(user.userId, dto, ip, userAgent);

    return { message: 'Password changed successfully. Please sign in again.' };
  }
}
