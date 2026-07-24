import { Injectable } from '@nestjs/common';
import { UrlCreateService } from '../use-cases/url-create.service';
import { UrlRedirectService } from '../use-cases/url-redirect.service';
import { UrlQrService, type QrResult } from '../use-cases/url-qr.service';
import { CreateUrlDto } from '../dto/create-url.dto';

@Injectable()
export class UrlsService {
  constructor(
    private readonly creator: UrlCreateService,
    private readonly redirector: UrlRedirectService,
    private readonly qrService: UrlQrService,
  ) {}

  create(dto: CreateUrlDto) {
    return this.creator.create(dto);
  }

  redirect(
    shortCode: string,
    requestMeta?: {
      userAgent: string;
      referrer?: string;
      ip?: string;
    },
  ) {
    return this.redirector.redirect(shortCode, requestMeta);
  }

  getQrCode(
    shortCode: string,
    format: 'png' | 'svg',
    size: number,
  ): Promise<QrResult> {
    return this.qrService.generate(shortCode, format, size);
  }
}
