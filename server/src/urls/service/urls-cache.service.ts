import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CacheService } from '../../cache/service/cache.service';
import { CachedUrl } from '../../cache/types';

@Injectable()
export class UrlCacheService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UrlCacheService.name);
  }

  /**
   * Cache-aside GET: returns CachedUrl on hit, null on miss or negative cache hit.
   */
  async get(shortCode: string): Promise<CachedUrl | null> {
    return this.cacheService.get(shortCode);
  }

  /**
   * Store a resolved URL in cache with TTL.
   */
  async set(shortCode: string, data: CachedUrl): Promise<void> {
    return this.cacheService.set(shortCode, data);
  }

  /**
   * Cache a negative (not-found) result to blunt lookups for garbage codes.
   */
  async setNegative(shortCode: string): Promise<void> {
    return this.cacheService.setNegative(shortCode);
  }

  /**
   * Invalidate a cached entry (on update/delete/disable).
   */
  async invalidate(shortCode: string): Promise<void> {
    return this.cacheService.invalidate(shortCode);
  }

  /**
   * Invalidate both shortCode and customAlias keys if they differ.
   */
  async invalidateAll(
    shortCode: string,
    customAlias: string | null,
  ): Promise<void> {
    return this.cacheService.invalidateAll(shortCode, customAlias);
  }
}
