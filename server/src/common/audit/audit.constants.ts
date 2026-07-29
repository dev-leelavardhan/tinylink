export const AUDIT_CONSTANTS = {
  QUEUE_NAME: 'audit-retention',
  JOB_CLEANUP: 'audit-cleanup',
  CLEANUP_JOB_ID: 'audit-cleanup-repeatable',
  // Run daily at 03:30 (offset from analytics cleanup to spread load).
  CLEANUP_CRON: '30 3 * * *',
  DEFAULT_RETENTION_DAYS: 180,
  MAX_JOB_ATTEMPTS: 3,
  JOB_BACKOFF_DELAY_MS: 5000,
  COMPLETED_JOB_MAX_AGE_SECONDS: 3600,
  FAILED_JOB_MAX_AGE_SECONDS: 24 * 3600,
  WORKER_CONCURRENCY: 1,
} as const;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function auditRetentionCutoff(days: number): Date {
  return new Date(Date.now() - days * MILLISECONDS_PER_DAY);
}
