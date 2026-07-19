export const URL_CONSTANTS = {
  MAX_SHORT_CODE_ATTEMPTS: 5,
} as const;

export const URL_CREATE_ERROR_MESSAGES = {
  CREATE_FAILED: 'Failed to create short URL',
  UNIQUE_CODE_GENERATION_FAILED: 'Unable to generate unique short code',
} as const;

export const URL_CREATE_LOG_MESSAGES = {
  CREATE_STARTED: 'Creating short URL',
  CREATE_SUCCESS: 'Short URL created',
  REUSED_EXISTING: 'Returning existing short URL',
  COLLISION: 'Short code collision detected',
} as const;

export const URL_REDIRECT_LOG_MESSAGES = {
  RESOLVING_URL: 'Resolving short URL',
  REDIRECT_SUCCESS: 'Redirected to original URL',
} as const;

export const URL_REDIRECT_ERROR_MESSAGES = {
  URL_NOT_FOUND: 'Short URL not found',
  RESOLVE_FAILED: 'Failed to resolve short URL',
} as const;
