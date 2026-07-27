import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import QRCode from 'qrcode';

import { QR_ERROR_MESSAGES, QR_LOG_MESSAGES } from '../constants/qr.constants';
import { UrlRepository } from '../repositories/url.repository';
import { UrlSlugRepository } from '../repositories/url-slug.repository';

export interface QrResult {
  buffer: Buffer;
  contentType: string;
}

@Injectable()
export class UrlQrService {
  constructor(
    private readonly urlRepository: UrlRepository,
    private readonly urlSlugRepository: UrlSlugRepository,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UrlQrService.name);
  }

  async generate(
    shortCode: string,
    format: 'png' | 'svg',
    size: number,
  ): Promise<QrResult> {
    try {
      const slug = await this.urlSlugRepository.findBySlug(shortCode);
      const url = slug ? await this.urlRepository.findById(slug.urlId) : null;

      if (!url || url.deletedAt) {
        throw new NotFoundException(QR_ERROR_MESSAGES.URL_NOT_FOUND);
      }

      const baseUrl = this.config.getOrThrow<string>('BASE_URL');
      const fullShortUrl = `${baseUrl}/${url.shortCode}`;

      this.logger.info(
        { shortCode: url.shortCode, format, size },
        QR_LOG_MESSAGES.QR_GENERATED,
      );

      if (format === 'svg') {
        const svg = await QRCode.toString(fullShortUrl, {
          type: 'svg',
          width: size,
        });
        return {
          buffer: Buffer.from(svg, 'utf-8'),
          contentType: 'image/svg+xml',
        };
      }

      const buffer = await QRCode.toBuffer(fullShortUrl, {
        type: 'png',
        width: size,
      });
      return {
        buffer,
        contentType: 'image/png',
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        { err: error, shortCode },
        QR_ERROR_MESSAGES.GENERATION_FAILED,
      );

      throw new InternalServerErrorException(
        QR_ERROR_MESSAGES.GENERATION_FAILED,
      );
    }
  }
}
