import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Redirect,
} from '@nestjs/common';
import { createUrlSchema, type CreateUrlDto } from '../dto/create-url.dto';
import { UrlsService } from '../service/urls.service';
import { CreateUrlResponseDto } from '../urls.interface';
import { ZodValidationPipe } from '../../common/zod/common.validation';

@Controller('urls')
export class UrlsController {
  constructor(private readonly urlsService: UrlsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(createUrlSchema))
    dto: CreateUrlDto,
  ): Promise<CreateUrlResponseDto> {
    return this.urlsService.create(dto);
  }
}

@Controller()
export class RedirectController {
  constructor(private readonly urlsService: UrlsService) {}

  @Get(':shortCode')
  @Redirect(undefined, HttpStatus.FOUND)
  async redirect(@Param('shortCode') shortCode: string) {
    const url = await this.urlsService.redirect(shortCode);
    return { url };
  }
}
