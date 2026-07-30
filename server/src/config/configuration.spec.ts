import configuration from './configuration';

describe('configuration (unit)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns parsed env when valid', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
    process.env.BASE_URL = 'http://localhost:3000';
    process.env.IP_HASH_SALT = 'a'.repeat(16);
    process.env.MAILER_HOST = 'smtp.example.com';
    process.env.MAILER_USER = 'user';
    process.env.MAILER_PASS = 'pass';
    process.env.MAILER_FROM = 'noreply@example.com';

    const result = configuration();

    expect(result.DATABASE_URL).toBe('postgresql://localhost:5432/db');
    expect(result.PORT).toBe(3000);
    expect(result.SHORT_CODE_STRATEGY).toBe('random');
  });

  it('throws when env is invalid', () => {
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.BASE_URL;

    expect(() => configuration()).toThrow('Environment validation failed');
  });
});
