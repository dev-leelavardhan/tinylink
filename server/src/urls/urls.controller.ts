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
import { type CreateUrlDto, createUrlSchema } from './dto/create-url.dto';
import { UrlsService } from './urls.service';
import { ZodValidationPipe } from '../zod/common.validation';
import { CreateUrlResponseDto } from './dto/create-utl-response-dto';

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
