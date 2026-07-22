export const ANALYTICS_CONSTANTS = {
  // Queue
  QUEUE_NAME: 'analytics',
  JOB_CLICK: 'click',
  JOB_CLEANUP: 'cleanup',
  CLEANUP_JOB_ID: 'daily-cleanup',
  CLEANUP_CRON: '0 3 * * *',

  // Worker
  WORKER_CONCURRENCY: 5,
  MAX_JOB_ATTEMPTS: 3,
  JOB_BACKOFF_DELAY_MS: 2_000,

  // Cleanup
  DEFAULT_RETENTION_DAYS: 90,
  COMPLETED_JOB_MAX_AGE_SECONDS: 7 * 86_400,
  FAILED_JOB_MAX_AGE_SECONDS: 30 * 86_400,

  // Pagination
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,

  // Analytics
  DEFAULT_ANALYTICS_DAYS: 30,
  MAX_ANALYTICS_DAYS: 365,
} as const;

export const ANALYTICS_LOG_MESSAGES = {
  CLICK_PROCESSED: 'Click analytics processed',
  CLEANUP_COMPLETED: 'Cleanup completed',
  ENQUEUE_FAILED: 'Failed to enqueue analytics',
  CLICK_ENQUEUED: 'Click event enqueued',
} as const;

export const ANALYTICS_ERROR_MESSAGES = {
  CLICK_PROCESS_FAILED: 'Analytics click processing failed',
  CLEANUP_FAILED: 'Failed to run analytics cleanup',
  WORKER_ERROR: 'Analytics worker error',
  READ_FAILED: 'Failed to read analytics',
} as const;
