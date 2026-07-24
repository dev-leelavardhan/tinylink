export const USER_CONSTANTS = {
  // Password
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  BCRYPT_ROUNDS: 10,

  // JWT
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: '7d',

  // Rate Limiting
  ANONYMOUS_URL_LIMIT: 5,
  RATE_LIMIT_TTL_SECONDS: 86_400,
  RATE_LIMIT_KEY_PREFIX: 'url:create:ip:',
} as const;

export const USER_LOG_MESSAGES = {
  REGISTER_SUCCESS: 'User registered successfully',
  LOGIN_SUCCESS: 'User logged in',
  PROFILE_FETCHED: 'User profile fetched',
} as const;

export const USER_ERROR_MESSAGES = {
  REGISTER_FAILED: 'Registration failed',
  LOGIN_FAILED: 'Invalid email or password',
  ACCOUNT_NOT_ACTIVE: 'Account is not active',
  USER_NOT_FOUND: 'User not found',
  TOKEN_REVOKED: 'Token has been revoked',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token',
  EMAIL_EXISTS: 'Email already exists',
  FREE_LIMIT_REACHED: 'Free limit reached. Sign up to create more URLs.',
} as const;
