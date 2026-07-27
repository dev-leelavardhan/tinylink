import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';

import { ZodValidationPipe } from '../../common/zod/common.validation';
import {
  changePasswordSchema,
  type ChangePasswordDto,
} from '../dto/change-password.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { type UserProfileResponse } from '../mappers/types';
import { UsersService } from '../service/users.service';
import { getClientIp } from '../utils/auth.utils';

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

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request()
    req: {
      user: { userId: string };
      headers: Record<string, string | string[] | undefined>;
      ip?: string;
    },
    @Body(new ZodValidationPipe(changePasswordSchema))
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const userId = req.user.userId;
    const ip = getClientIp(req.headers, req.ip);
    const userAgent = req.headers['user-agent'] as string | undefined;

    await this.usersService.changePassword(userId, dto, ip, userAgent);

    return { message: 'Password changed successfully' };
  }
}
