export const CACHE_CONSTANTS = {
  /** Default TTL in seconds for positive cache entries (1 hour) */
  DEFAULT_TTL_SECONDS: 3600,

  /** TTL for negative cache (not-found) — 60 seconds */
  NEGATIVE_TTL_SECONDS: 60,

  /** Redis key prefix for URL cache entries */
  KEY_PREFIX: 'url:',

  /** Sentinel value stored for negative cache (not-found) */
  NEGATIVE_SENTINEL: 'NOT_FOUND',
} as const;

export const CACHE_LOG_MESSAGES = {
  CACHE_HIT: 'Cache hit',
  CACHE_MISS: 'Cache miss',
  CACHE_HIT_NEGATIVE: 'Cache hit (negative)',
  CACHE_SET: 'Cache SET',
  CACHE_SET_NEGATIVE: 'Cache SET (negative)',
  CACHE_DEL: 'Cache DEL',
  CACHE_GET_FAILED: 'Cache GET failed, falling back to DB',
  CACHE_SET_FAILED: 'Cache SET failed',
  CACHE_SET_NEGATIVE_FAILED: 'Cache SET negative failed',
  CACHE_DEL_FAILED: 'Cache DEL failed',
} as const;

export const CACHE_ERROR_MESSAGES = {
  GET_FAILED: 'Failed to get from cache',
  SET_FAILED: 'Failed to set cache',
  INVALIDATE_FAILED: 'Failed to invalidate cache',
} as const;
