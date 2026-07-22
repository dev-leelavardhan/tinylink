import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CachedUrl } from '../../redis/redis.interface';
import { CreateUrlResponseDto, Url } from '../urls.interface';

@Injectable()
export class UrlMapper {
  constructor(private readonly config: ConfigService) {}

  toResponse(url: Url): CreateUrlResponseDto {
    return {
      id: url.id,
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      shortUrl: new URL(
        url.shortCode,
        this.config.getOrThrow('BASE_URL'),
      ).toString(),
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
    };
  }
}
