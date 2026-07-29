import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Redirect,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import { ZodValidationPipe } from '../../common/zod/common.validation';
import { createUrlSchema, type CreateUrlDto } from '../dto/create-url.dto';
import { UrlsService } from '../service/urls.service';
import { type CreateUrlResponseDto } from '../types';
import { JwtAuthOptionalGuard } from '../../common/auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/auth/current-user.decorator';

@Controller('urls')
export class UrlsController {
  constructor(private readonly urlsService: UrlsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthOptionalGuard)
  async create(
    @Body(new ZodValidationPipe(createUrlSchema))
    dto: CreateUrlDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Req() req: Request,
  ): Promise<CreateUrlResponseDto> {
    const userId = user?.userId;
    const ip = req.ip ?? (req.socket ? req.socket.remoteAddress : undefined);
    return this.urlsService.create(dto, userId, ip);
  }
}

/**
 * Generous per-IP ceiling for the redirect hot path. Well above real human
 * usage, but caps bot-driven analytics write amplification. One Redis INCR per
 * hit, far cheaper than the per-click DB write it protects.
 */
const REDIRECT_THROTTLE = { limit: 600, ttl: 60_000 };

@Controller()
@Throttle({ default: REDIRECT_THROTTLE })
export class RedirectController {
  constructor(private readonly urlsService: UrlsService) {}

  @Get(':shortCode')
  @Redirect(undefined, HttpStatus.FOUND)
  async redirect(
    @Param('shortCode') shortCode: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const ip = req.ip ?? (req.socket ? req.socket.remoteAddress : undefined);
    const url = await this.urlsService.redirect(shortCode, {
      userAgent: req.headers['user-agent'] ?? '',
      referrer: req.headers['referer'],
      ip,
    });
    return { url };
  }
}
