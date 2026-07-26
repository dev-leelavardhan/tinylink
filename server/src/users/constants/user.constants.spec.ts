import {
  USER_CONSTANTS,
  USER_LOG_MESSAGES,
  USER_ERROR_MESSAGES,
} from './user.constants';

describe('USER_CONSTANTS', () => {
  it('should have password constants', () => {
    expect(USER_CONSTANTS.MIN_PASSWORD_LENGTH).toBe(8);
    expect(USER_CONSTANTS.MAX_PASSWORD_LENGTH).toBe(128);
  });

  it('should have argon2 constants', () => {
    expect(USER_CONSTANTS.ARGON2_TIME_COST).toBe(3);
    expect(USER_CONSTANTS.ARGON2_MEMORY_COST).toBe(65536);
    expect(USER_CONSTANTS.ARGON2_PARALLELISM).toBe(4);
  });

  it('should have JWT constants', () => {
    expect(USER_CONSTANTS.ACCESS_TOKEN_EXPIRY).toBe('15m');
    expect(USER_CONSTANTS.REFRESH_TOKEN_EXPIRY).toBe('7d');
  });

  it('should have OTP constants', () => {
    expect(USER_CONSTANTS.OTP_LENGTH).toBe(6);
    expect(USER_CONSTANTS.OTP_EXPIRY_SECONDS).toBe(600);
    expect(USER_CONSTANTS.OTP_KEY_PREFIX).toBe('otp:verify:');
  });

  it('should have rate limiting constants', () => {
    expect(USER_CONSTANTS.ANONYMOUS_URL_LIMIT).toBe(5);
    expect(USER_CONSTANTS.RATE_LIMIT_TTL_SECONDS).toBe(86400);
    expect(USER_CONSTANTS.RATE_LIMIT_KEY_PREFIX).toBe('url:create:ip:');
  });

  it('should have brute force constants', () => {
    expect(USER_CONSTANTS.MAX_FAILED_LOGIN_ATTEMPTS).toBe(5);
    expect(USER_CONSTANTS.LOCK_DURATION_MINUTES).toBe(15);
    expect(USER_CONSTANTS.LOGIN_RATE_LIMIT_PER_ACCOUNT).toBe(20);
    expect(USER_CONSTANTS.LOGIN_RATE_LIMIT_WINDOW_SECONDS).toBe(3600);
  });

  it('should have session constants', () => {
    expect(USER_CONSTANTS.SESSION_EXPIRY_DAYS).toBe(7);
    expect(USER_CONSTANTS.SESSION_COOKIE_NAME).toBe('refresh_token');
    expect(USER_CONSTANTS.SESSION_COOKIE_PATH).toBe('/auth/refresh');
  });

  it('should have login response constants', () => {
    expect(USER_CONSTANTS.LOGIN_ACCESS_TOKEN_EXPIRY_SECONDS).toBe(900);
    expect(USER_CONSTANTS.LOGIN_TOKEN_TYPE).toBe('Bearer');
  });
});

describe('USER_LOG_MESSAGES', () => {
  it('should have all log messages', () => {
    expect(USER_LOG_MESSAGES.REGISTER_SUCCESS).toBeDefined();
    expect(USER_LOG_MESSAGES.LOGIN_SUCCESS).toBeDefined();
    expect(USER_LOG_MESSAGES.LOGIN_FAILED).toBeDefined();
    expect(USER_LOG_MESSAGES.PROFILE_FETCHED).toBeDefined();
    expect(USER_LOG_MESSAGES.OTP_GENERATED).toBeDefined();
    expect(USER_LOG_MESSAGES.OTP_SENT).toBeDefined();
    expect(USER_LOG_MESSAGES.OTP_VERIFIED).toBeDefined();
    expect(USER_LOG_MESSAGES.ACCOUNT_LOCKED).toBeDefined();
    expect(USER_LOG_MESSAGES.ACCOUNT_UNLOCKED).toBeDefined();
    expect(USER_LOG_MESSAGES.SESSION_CREATED).toBeDefined();
    expect(USER_LOG_MESSAGES.SESSION_REVOKED).toBeDefined();
    expect(USER_LOG_MESSAGES.REFRESH_TOKEN_ISSUED).toBeDefined();
  });
});

describe('USER_ERROR_MESSAGES', () => {
  it('should have all error messages', () => {
    expect(USER_ERROR_MESSAGES.REGISTER_FAILED).toBeDefined();
    expect(USER_ERROR_MESSAGES.LOGIN_FAILED).toBeDefined();
    expect(USER_ERROR_MESSAGES.ACCOUNT_NOT_ACTIVE).toBeDefined();
    expect(USER_ERROR_MESSAGES.ACCOUNT_PENDING_VERIFICATION).toBeDefined();
    expect(USER_ERROR_MESSAGES.ACCOUNT_DISABLED).toBeDefined();
    expect(USER_ERROR_MESSAGES.ACCOUNT_SUSPENDED).toBeDefined();
    expect(USER_ERROR_MESSAGES.ACCOUNT_LOCKED).toBeDefined();
    expect(USER_ERROR_MESSAGES.USER_NOT_FOUND).toBeDefined();
    expect(USER_ERROR_MESSAGES.TOKEN_REVOKED).toBeDefined();
    expect(USER_ERROR_MESSAGES.INVALID_REFRESH_TOKEN).toBeDefined();
    expect(USER_ERROR_MESSAGES.EMAIL_EXISTS).toBeDefined();
    expect(USER_ERROR_MESSAGES.FREE_LIMIT_REACHED).toBeDefined();
    expect(USER_ERROR_MESSAGES.INVALID_OTP).toBeDefined();
    expect(USER_ERROR_MESSAGES.OTP_GENERATION_FAILED).toBeDefined();
    expect(USER_ERROR_MESSAGES.EMAIL_SEND_FAILED).toBeDefined();
    expect(USER_ERROR_MESSAGES.PASSWORD_WEAK).toBeDefined();
  });
});
