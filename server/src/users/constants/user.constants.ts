export const USER_CONSTANTS = {
  // Password
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,

  // Argon2
  ARGON2_TIME_COST: 3,
  ARGON2_MEMORY_COST: 65536,
  ARGON2_PARALLELISM: 4,

  // JWT
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: '7d',

  // OTP
  OTP_LENGTH: 6,
  OTP_EXPIRY_SECONDS: 600,
  OTP_KEY_PREFIX: 'otp:verify:',
  OTP_MAX_ATTEMPTS: 5,
  OTP_RESEND_COOLDOWN_SECONDS: 60,
  OTP_MAX_RESEND_PER_WINDOW: 3,
  OTP_RESEND_WINDOW_SECONDS: 600,

  // Rate Limiting
  ANONYMOUS_URL_LIMIT: 5,
  RATE_LIMIT_TTL_SECONDS: 86_400,
  RATE_LIMIT_KEY_PREFIX: 'url:create:ip:',

  // Brute Force Protection
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  LOCK_DURATION_MINUTES: 15,
  LOGIN_RATE_LIMIT_PER_ACCOUNT: 20,
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: 3600,
  BRUTE_FORCE_KEY_PREFIX: 'auth:failed:',
  BRUTE_FORCE_LOCK_KEY_PREFIX: 'auth:locked:',
  BRUTE_FORCE_RATE_LIMIT_KEY_PREFIX: 'auth:ratelimit:',

  // Session
  SESSION_EXPIRY_DAYS: 7,
  MAX_SESSIONS_PER_USER: 10,
  SESSION_COOKIE_NAME: 'refresh_token',
  SESSION_COOKIE_PATH: '/auth',
  SESSION_COOKIE_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,
  SLIDING_SESSION_ENABLED: false,

  // JWT
  JWT_ISSUER: 'tinylink',
  JWT_AUDIENCE: 'tinylink-api',

  // Session Cleanup
  SESSION_CLEANUP_QUEUE: 'users-cleanup',
  SESSION_CLEANUP_JOB_NAME: 'cleanup',
  SESSION_CLEANUP_CRON: '0 4 * * *',
  SESSION_CLEANUP_JOB_ID: 'session-cleanup',
  SESSION_CLEANUP_RETENTION_DAYS: 30,
  SESSION_CLEANUP_MAX_JOB_ATTEMPTS: 3,
  SESSION_CLEANUP_JOB_BACKOFF_DELAY_MS: 2_000,
  SESSION_CLEANUP_COMPLETED_JOB_MAX_AGE_SECONDS: 7 * 86_400,
  SESSION_CLEANUP_FAILED_JOB_MAX_AGE_SECONDS: 30 * 86_400,
  SESSION_CLEANUP_WORKER_CONCURRENCY: 1,

  // Login Response
  LOGIN_ACCESS_TOKEN_EXPIRY_SECONDS: 900,
  LOGIN_TOKEN_TYPE: 'Bearer',

  // Refresh Token Reuse Detection
  REFRESH_TOKEN_REUSE_WINDOW_MINUTES: 5,
} as const;

export const USER_LOG_MESSAGES = {
  REGISTER_SUCCESS: 'User registered successfully',
  LOGIN_SUCCESS: 'User logged in',
  LOGIN_FAILED: 'Login failed',
  PROFILE_FETCHED: 'User profile fetched',
  OTP_GENERATED: 'Verification OTP generated',
  OTP_SENT: 'Verification email sent',
  OTP_VERIFIED: 'Email verified successfully',
  OTP_STORED_IN_DB: 'OTP stored in database (Redis unavailable)',
  OTP_RATE_LIMITED: 'OTP request rate limited',
  OTP_MAX_ATTEMPTS_REACHED: 'OTP max attempts reached',
  OTP_RESEND_SUCCESS: 'Verification OTP resent',
  ACCOUNT_LOCKED: 'Account temporarily locked',
  ACCOUNT_UNLOCKED: 'Account unlocked',
  SESSION_CREATED: 'Session created',
  SESSION_REVOKED: 'Session revoked',
  REFRESH_TOKEN_ISSUED: 'Refresh token issued',
  LOGOUT_SUCCESS: 'User logged out',
  LOGOUT_ALL_SUCCESS: 'All sessions revoked',
  GLOBAL_LOGOUT: 'All sessions revoked',
  PASSWORD_CHANGED: 'Password changed successfully',
  PASSWORD_RESET_REQUESTED: 'Password reset requested',
  PASSWORD_RESET_COMPLETED: 'Password reset completed',
  SESSION_CLEANUP_STARTED: 'Starting session cleanup',
  SESSION_CLEANUP_COMPLETED: 'Session cleanup completed',
} as const;

export const USER_ERROR_MESSAGES = {
  REGISTER_FAILED: 'Registration failed',
  LOGIN_FAILED: 'Invalid email or password',
  ACCOUNT_NOT_ACTIVE: 'Account is not active',
  ACCOUNT_PENDING_VERIFICATION: 'Account pending email verification',
  ACCOUNT_DISABLED: 'Account is disabled.',
  ACCOUNT_SUSPENDED: 'Account is suspended.',
  ACCOUNT_LOCKED: 'Too many failed login attempts. Try again later.',
  USER_NOT_FOUND: 'User not found',
  TOKEN_REVOKED: 'Token has been revoked',
  MISSING_REFRESH_TOKEN: 'Authentication required.',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token',
  SESSION_EXPIRED: 'Session expired.',
  SESSION_REVOKED: 'Session revoked.',
  EMAIL_EXISTS: 'Email already exists',
  FREE_LIMIT_REACHED: 'Free limit reached. Sign up to create more URLs.',
  INVALID_OTP: 'Invalid or expired verification code',
  OTP_GENERATION_FAILED: 'Failed to generate verification code',
  EMAIL_SEND_FAILED: 'Failed to send verification email',
  PASSWORD_WEAK: 'Password does not meet strength requirements',
  OTP_RATE_LIMITED:
    'Too many verification requests. Please wait before trying again.',
  OTP_MAX_ATTEMPTS: 'Too many failed attempts. Please request a new code.',
  OTP_RESEND_COOLDOWN: 'Please wait before requesting a new code.',
  REFRESH_TOKEN_REUSE_DETECTED:
    'Security violation: refresh token reuse detected',
  CHANGE_PASSWORD_CURRENT_INVALID: 'Current password is incorrect.',
  CHANGE_PASSWORD_REUSE:
    'New password must be different from the current password.',
  INVALID_PASSWORD_RESET_CODE: 'Invalid password reset code.',
  PASSWORD_RESET_CODE_EXPIRED: 'Password reset code has expired.',
  PASSWORD_RESET_CODE_USED: 'Password reset code has already been used.',
  SESSION_CLEANUP_FAILED: 'Session cleanup failed',
} as const;
