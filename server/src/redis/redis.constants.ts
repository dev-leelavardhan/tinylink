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
