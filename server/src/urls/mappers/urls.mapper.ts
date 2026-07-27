import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type CachedUrl } from '../../cache/types';
import { type CreateUrlResponseDto, type Url } from '../types';

@Injectable()
export class UrlMapper {
  constructor(private readonly config: ConfigService) {}

  toResponse(url: Url): CreateUrlResponseDto {
    const code = url.customAlias ?? url.shortCode;
    return {
      id: url.id,
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      shortUrl: new URL(code, this.config.getOrThrow('BASE_URL')).toString(),
    };
  }

  toCached(url: Url): CachedUrl {
    return {
      id: url.id,
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      customAlias: url.customAlias,
      disabled: url.disabled,
      expiresAt: url.expiresAt?.toISOString() ?? null,
      lastAccessedAt: new Date().toISOString(),
      deletedAt: url.deletedAt?.toISOString() ?? null,
    };
  }
}
