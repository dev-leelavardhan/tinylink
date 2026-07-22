export const ANALYTICS_CONSTANTS = {
  QUEUE_NAME: 'analytics',
  JOB_CLICK: 'click',
  JOB_CLEANUP: 'cleanup',
  CLEANUP_CRON: '0 3 * * *',
  DEFAULT_RETENTION_DAYS: 90,
  WORKER_CONCURRENCY: 5,
  MAX_JOB_ATTEMPTS: 3,
  BACKOFF_DELAY_MS: 2000,
  COMPLETED_JOB_MAX_AGE_SECONDS: 7 * 86400,
  FAILED_JOB_MAX_AGE_SECONDS: 30 * 86400,
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
} as const;

export const ANALYTICS_LOG_MESSAGES = {
  CLICK_PROCESSED: 'Click analytics processed',
  CLEANUP_COMPLETED: 'Cleanup completed',
  ENQUEUE_FAILED: 'Failed to enqueue analytics',
  CLICK_ENQUEUED: 'Click event enqueued',
} as const;

export const ANALYTICS_ERROR_MESSAGES = {
  CLICK_PROCESS_FAILED: 'Failed to process click analytics',
  CLEANUP_FAILED: 'Failed to run analytics cleanup',
  WORKER_ERROR: 'Worker error',
  READ_FAILED: 'Failed to read analytics',
} as const;
