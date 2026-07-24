export const QR_CONSTANTS = {
  // Defaults
  DEFAULT_FORMAT: 'png',
  DEFAULT_SIZE: 300,
  MIN_SIZE: 100,
  MAX_SIZE: 1000,
  // Cache
  CACHE_MAX_AGE_SECONDS: 365 * 24 * 60 * 60, // 1 year
} as const;

export const QR_LOG_MESSAGES = {
  QR_GENERATED: 'QR code generated',
  URL_NOT_FOUND: 'URL not found for QR generation',
} as const;

export const QR_ERROR_MESSAGES = {
  URL_NOT_FOUND: 'URL not found',
  GENERATION_FAILED: 'Failed to generate QR code',
} as const;
