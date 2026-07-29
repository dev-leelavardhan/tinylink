import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Identifier, type Url } from '@prisma/client';
import { type CachedIdentifier } from '../../cache/types';
import { type CreateUrlResponseDto } from '../types';

@Injectable()
export class UrlMapper {
  constructor(private readonly config: ConfigService) {}

  toResponse(url: Url, identifier: Identifier): CreateUrlResponseDto {
    return {
      id: identifier.id,
      originalUrl: url.originalUrl,
      shortCode: identifier.code,
      shortUrl: new URL(
        identifier.code,
        this.config.getOrThrow('BASE_URL'),
      ).toString(),
    };
  }

  toCached(url: Url, identifier: Identifier): CachedIdentifier {
    return {
      id: identifier.id,
      urlId: url.id,
      originalUrl: url.originalUrl,
      code: identifier.code,
      kind: identifier.kind,
      ownerId: identifier.ownerId,
      strategy: identifier.strategy,
      expiresAt: identifier.expiresAt?.toISOString() ?? null,
      disabled: identifier.disabled,
      deletedAt: identifier.deletedAt?.toISOString() ?? null,
    };
  }
}
