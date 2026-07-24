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
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { ZodValidationPipe } from '../../common/zod/common.validation';
import { createUrlSchema, type CreateUrlDto } from '../dto/create-url.dto';
import { UrlsService } from '../service/urls.service';
import { type CreateUrlResponseDto } from '../types';
import { JwtAuthOptionalGuard } from '../../users/guards/jwt-auth.guard';

@Controller('urls')
export class UrlsController {
  constructor(private readonly urlsService: UrlsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthOptionalGuard)
  async create(
    @Body(new ZodValidationPipe(createUrlSchema))
    dto: CreateUrlDto,
    @Req() req: Request & { user?: { userId: string } },
  ): Promise<CreateUrlResponseDto> {
    const userId = req.user?.userId;
    const ip = req.ip ?? (req.socket ? req.socket.remoteAddress : undefined);
    return this.urlsService.create(dto, userId, ip);
  }
}

@Controller()
export class RedirectController {
  constructor(private readonly urlsService: UrlsService) {}

  @Get(':shortCode')
  @Redirect(undefined, HttpStatus.FOUND)
  async redirect(@Param('shortCode') shortCode: string, @Req() req: Request) {
    const ip = req.ip ?? (req.socket ? req.socket.remoteAddress : undefined);
    const url = await this.urlsService.redirect(shortCode, {
      userAgent: req.headers['user-agent'] ?? '',
      referrer: req.headers['referer'],
      ip,
    });
    return { url };
  }
}
