export const REDIS_CONSTANTS = {
  /** Maximum retries per request */
  MAX_RETRIES_PER_REQUEST: 3,

  /** Base delay for retry strategy in milliseconds */
  RETRY_BASE_DELAY_MS: 200,

  /** Maximum delay for retry strategy in milliseconds */
  RETRY_MAX_DELAY_MS: 2000,

  /** Keep-alive interval in milliseconds */
  KEEPALIVE_INTERVAL_MS: 30000,
} as const;

export const REDIS_LOG_MESSAGES = {
  CONNECTED: 'Redis connected',
  CONNECTION_FAILED: 'Redis connection failed',
  DISCONNECTING: 'Redis disconnecting',
} as const;

export const REDIS_ERROR_MESSAGES = {
  CONNECTION_FAILED: 'Failed to connect to Redis',
  DISCONNECTION_FAILED: 'Failed to disconnect from Redis',
} as const;
