import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import QRCode from 'qrcode';

import { QR_ERROR_MESSAGES, QR_LOG_MESSAGES } from '../constants/qr.constants';
import { IdentifierRepository } from '../repositories/identifier.repository';

export interface QrResult {
  buffer: Buffer;
  contentType: string;
}

@Injectable()
export class UrlQrService {
  constructor(
    private readonly identifierRepository: IdentifierRepository,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UrlQrService.name);
  }

  async generate(
    code: string,
    format: 'png' | 'svg',
    size: number,
  ): Promise<QrResult> {
    try {
      const identifier =
        await this.identifierRepository.findByIdentifierCode(code);

      if (
        !identifier ||
        identifier.deletedAt ||
        identifier.disabled ||
        (identifier.expiresAt && identifier.expiresAt <= new Date())
      ) {
        throw new NotFoundException(QR_ERROR_MESSAGES.URL_NOT_FOUND);
      }

      const baseUrl = this.config.getOrThrow<string>('BASE_URL');
      const fullShortUrl = `${baseUrl}/${identifier.code}`;

      this.logger.info(
        { code: identifier.code, format, size },
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
        { err: error, code },
        QR_ERROR_MESSAGES.GENERATION_FAILED,
      );

      throw new InternalServerErrorException(
        QR_ERROR_MESSAGES.GENERATION_FAILED,
      );
    }
  }
}
