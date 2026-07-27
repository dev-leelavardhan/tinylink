import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { RedisService } from '../../redis/service/redis.service';

const INCREMENT_SCRIPT = `
local key = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

-- Check if currently blocked
local blockedTtl = redis.call('PTTL', blockKey)
if blockedTtl > 0 then
  return {limit + 1, ttl, 1, blockedTtl}
end

-- Increment and set expiry atomically
local totalHits = redis.call('INCR', key)
if totalHits == 1 then
  redis.call('PEXPIRE', key, ttl)
end

local currentTtl = redis.call('PTTL', key)

-- Block if limit exceeded
if totalHits > limit then
  redis.call('SET', blockKey, '1', 'PX', blockDuration)
  return {totalHits, currentTtl, 1, blockDuration}
end

return {totalHits, currentTtl, 0, 0}
`;

@Injectable()
export class ThrottlerRedisStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const recordKey = `throttle:${key}`;
    const blockKey = `throttle:block:${key}`;
    const now = Date.now();

    const result = (await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      recordKey,
      blockKey,
      ttl,
      limit,
      blockDuration,
      now,
    )) as [number, number, number, number];

    const [totalHits, currentTtlMs, isBlocked, blockExpiresMs] = result;

    // Convert Redis PTTL milliseconds to seconds for HTTP headers (Retry-After, RateLimit-Reset)
    const timeToExpireSec = Math.ceil(
      (currentTtlMs > 0 ? currentTtlMs : ttl) / 1000,
    );
    const timeToBlockExpireSec = Math.ceil(blockExpiresMs / 1000);

    return {
      totalHits,
      timeToExpire: timeToExpireSec,
      isBlocked: isBlocked === 1,
      timeToBlockExpire: timeToBlockExpireSec,
    };
  }
}
