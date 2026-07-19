export const SHORT_CODE_STRATEGIES = [
  'random',
  'hash',
  'hashids',
  'auto-increment',
  'snowflake',
] as const;

export type ShortCodeStrategy = (typeof SHORT_CODE_STRATEGIES)[number];

export const RANDOM_BASE_CONSTANTS = {
  RANDOM_BASE: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  RANDOM_BASE_LENGTH: 62,
  SHORT_CODE_LENGTH: 7,
} as const;

export const SHORT_CODE_SEQUENCE = 'short_code_counter' as const;

export const SHORT_CODE_CONFIG_KEYS = {
  STRATEGY: 'SHORT_CODE_STRATEGY',
  LENGTH: 'SHORT_CODE_LENGTH',
  HASHIDS_SALT: 'SHORT_CODE_HASHIDS_SALT',
  SNOWFLAKE_WORKER_ID: 'SHORT_CODE_SNOWFLAKE_WORKER_ID',
} as const;

/** Custom epoch: 2024-01-01T00:00:00.000Z */
export const SNOWFLAKE_EPOCH_MS = 1_704_067_200_000n;
export const SNOWFLAKE_WORKER_BITS = 10n;
export const SNOWFLAKE_SEQUENCE_BITS = 12n;
export const SNOWFLAKE_MAX_WORKER_ID = (1n << SNOWFLAKE_WORKER_BITS) - 1n;
export const SNOWFLAKE_MAX_SEQUENCE = (1n << SNOWFLAKE_SEQUENCE_BITS) - 1n;
