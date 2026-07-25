import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { ZodValidationPipe } from '../../common/zod/common.validation';
import { JwtAuthOptionalGuard } from '../../users/guards/jwt-auth.guard';
import { qrQuerySchema, type QrQueryDto } from '../dto/qr-query.dto';
import { UrlsService } from '../service/urls.service';

@Controller('urls')
export class QrController {
  constructor(private readonly urlsService: UrlsService) {}

  @Get(':shortCode/qr')
  @UseGuards(JwtAuthOptionalGuard)
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async getQrCode(
    @Param('shortCode') shortCode: string,
    @Query(new ZodValidationPipe(qrQuerySchema)) query: QrQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const result = await this.urlsService.getQrCode(
      shortCode,
      query.format,
      query.size,
    );
    res.setHeader('Content-Type', result.contentType);
    return new StreamableFile(result.buffer);
  }
}
