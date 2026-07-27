import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { RedisService } from '../../redis/service/redis.service';
import {
  CACHE_CONSTANTS,
  CACHE_LOG_MESSAGES,
} from '../constants/cache.constants';
import { CachedUrl, CacheResult } from '../types';

@Injectable()
export class CacheService {
  private readonly ttl: number;
  private readonly negativeTtl: number;

  constructor(
    private readonly redis: RedisService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CacheService.name);
    this.ttl = CACHE_CONSTANTS.DEFAULT_TTL_SECONDS;
    this.negativeTtl = CACHE_CONSTANTS.NEGATIVE_TTL_SECONDS;
  }

  private key(shortCode: string): string {
    return `${CACHE_CONSTANTS.KEY_PREFIX}${shortCode}`;
  }

  /**
   * Cache-aside GET: returns hit with data, negative (known not-found), or miss.
   */
  async get(shortCode: string): Promise<CacheResult> {
    try {
      const raw = await this.redis.get(this.key(shortCode));

      if (raw === null) {
        this.logger.debug({ shortCode }, CACHE_LOG_MESSAGES.CACHE_MISS);
        return { status: 'miss' };
      }

      if (raw === CACHE_CONSTANTS.NEGATIVE_SENTINEL) {
        this.logger.debug({ shortCode }, CACHE_LOG_MESSAGES.CACHE_HIT_NEGATIVE);
        return { status: 'negative' };
      }

      this.logger.debug({ shortCode }, CACHE_LOG_MESSAGES.CACHE_HIT);
      return { status: 'hit', data: JSON.parse(raw) as CachedUrl };
    } catch (err: unknown) {
      this.logger.warn({ shortCode, err }, CACHE_LOG_MESSAGES.CACHE_GET_FAILED);
      return { status: 'miss' };
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
      this.logger.debug({ shortCode }, CACHE_LOG_MESSAGES.CACHE_SET);
    } catch (err: unknown) {
      this.logger.warn({ shortCode, err }, CACHE_LOG_MESSAGES.CACHE_SET_FAILED);
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
      this.logger.debug({ shortCode }, CACHE_LOG_MESSAGES.CACHE_SET_NEGATIVE);
    } catch (err: unknown) {
      this.logger.warn(
        { shortCode, err },
        CACHE_LOG_MESSAGES.CACHE_SET_NEGATIVE_FAILED,
      );
    }
  }

  /**
   * Invalidate a cached entry (on update/delete/disable).
   */
  async invalidate(shortCode: string): Promise<void> {
    try {
      await this.redis.del(this.key(shortCode));
      this.logger.debug({ shortCode }, CACHE_LOG_MESSAGES.CACHE_DEL);
    } catch (err: unknown) {
      this.logger.warn({ shortCode, err }, CACHE_LOG_MESSAGES.CACHE_DEL_FAILED);
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
