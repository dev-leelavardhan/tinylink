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
} as const;

export const USER_LOG_MESSAGES = {
  REGISTER_SUCCESS: 'User registered successfully',
  LOGIN_SUCCESS: 'User logged in',
  PROFILE_FETCHED: 'User profile fetched',
  OTP_GENERATED: 'Verification OTP generated',
  OTP_SENT: 'Verification email sent',
  OTP_VERIFIED: 'Email verified successfully',
  OTP_STORED_IN_DB: 'OTP stored in database (Redis unavailable)',
  OTP_RATE_LIMITED: 'OTP request rate limited',
  OTP_MAX_ATTEMPTS_REACHED: 'OTP max attempts reached',
  OTP_RESEND_SUCCESS: 'Verification OTP resent',
} as const;

export const USER_ERROR_MESSAGES = {
  REGISTER_FAILED: 'Registration failed',
  LOGIN_FAILED: 'Invalid email or password',
  ACCOUNT_NOT_ACTIVE: 'Account is not active',
  ACCOUNT_PENDING_VERIFICATION: 'Account pending email verification',
  USER_NOT_FOUND: 'User not found',
  TOKEN_REVOKED: 'Token has been revoked',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token',
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
} as const;
