import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { CACHE_CONSTANTS } from '../../redis/redis.constants';
import { CachedUrl } from '../../redis/redis.interface';

@Injectable()
export class UrlCacheService {
  private readonly logger = new Logger(UrlCacheService.name);
  private readonly ttl: number;
  private readonly negativeTtl: number;

  constructor(private readonly redis: RedisService) {
    this.ttl = CACHE_CONSTANTS.DEFAULT_TTL_SECONDS;
    this.negativeTtl = CACHE_CONSTANTS.NEGATIVE_TTL_SECONDS;
  }

  private key(shortCode: string): string {
    return `${CACHE_CONSTANTS.KEY_PREFIX}${shortCode}`;
  }

  /**
   * Cache-aside GET: returns CachedUrl on hit, null on miss or negative cache hit.
   */
  async get(shortCode: string): Promise<CachedUrl | null> {
    try {
      const raw = await this.redis.get(this.key(shortCode));

      if (raw === null || raw === CACHE_CONSTANTS.NEGATIVE_SENTINEL) {
        this.logger.debug(
          { shortCode },
          raw === null ? 'Cache miss' : 'Cache hit (negative)',
        );
        return null;
      }

      this.logger.debug({ shortCode }, 'Cache hit');
      return JSON.parse(raw) as CachedUrl;
    } catch (err: unknown) {
      this.logger.warn(
        { shortCode, err },
        'Cache GET failed, falling back to DB',
      );
      return null;
    }
  }

  /**
   * Store a resolved URL in cache with TTL.
   */
  async set(shortCode: string, data: CachedUrl): Promise<void> {
    try {
      await this.redis.setex(
        this.key(shortCode),
        this.ttl,
        JSON.stringify(data),
      );
      this.logger.debug({ shortCode }, 'Cache SET');
    } catch (err: unknown) {
      this.logger.warn({ shortCode, err }, 'Cache SET failed');
    }
  }

  /**
   * Cache a negative (not-found) result to blunt lookups for garbage codes.
   */
  async setNegative(shortCode: string): Promise<void> {
    try {
      await this.redis.setex(
        this.key(shortCode),
        this.negativeTtl,
        CACHE_CONSTANTS.NEGATIVE_SENTINEL,
      );
      this.logger.debug({ shortCode }, 'Cache SET (negative)');
    } catch (err: unknown) {
      this.logger.warn({ shortCode, err }, 'Cache SET negative failed');
    }
  }

  /**
   * Invalidate a cached entry (on update/delete/disable).
   */
  async invalidate(shortCode: string): Promise<void> {
    try {
      await this.redis.del(this.key(shortCode));
      this.logger.debug({ shortCode }, 'Cache DEL');
    } catch (err: unknown) {
      this.logger.warn({ shortCode, err }, 'Cache DEL failed');
    }
  }

  /**
   * Invalidate both shortCode and customAlias keys if they differ.
   */
  async invalidateAll(
    shortCode: string,
    customAlias: string | null,
  ): Promise<void> {
    await this.invalidate(shortCode);
    if (customAlias && customAlias !== shortCode) {
      await this.invalidate(customAlias);
    }
  }
}
