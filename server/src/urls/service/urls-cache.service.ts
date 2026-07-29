import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CacheService } from '../../cache/service/cache.service';
import { CachedIdentifier, CacheResult } from '../../cache/types';

@Injectable()
export class UrlCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UrlCacheService.name);
  }

  async get(code: string): Promise<CacheResult> {
    return this.cacheService.get(code);
  }

  async set(code: string, data: CachedIdentifier): Promise<void> {
    return this.cacheService.set(code, data);
  }

  async setNegative(code: string): Promise<void> {
    return this.cacheService.setNegative(code);
  }

  async invalidate(code: string): Promise<void> {
    return this.cacheService.invalidate(code);
  }
}
