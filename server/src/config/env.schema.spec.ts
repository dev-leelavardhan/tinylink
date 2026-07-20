import { envSchema } from './env.schema';

describe('envSchema (unit)', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    BASE_URL: 'http://localhost:3000',
  };

  it('passes with valid env', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it('applies defaults for optional fields', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development');
      expect(result.data.PORT).toBe(3000);
      expect(result.data.SHORT_CODE_STRATEGY).toBe('random');
      expect(result.data.SHORT_CODE_LENGTH).toBe(7);
      expect(result.data.SHORT_CODE_SNOWFLAKE_WORKER_ID).toBe(1);
    }
  });

  it('rejects invalid NODE_ENV', () => {
    const result = envSchema.safeParse({ ...validEnv, NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid PORT', () => {
    const result = envSchema.safeParse({ ...validEnv, PORT: 99999 });
    expect(result.success).toBe(false);
  });

  it('rejects short JWT_ACCESS_SECRET', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      JWT_ACCESS_SECRET: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short JWT_REFRESH_SECRET', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      JWT_REFRESH_SECRET: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('requires SHORT_CODE_HASHIDS_SALT when strategy is hashids', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      SHORT_CODE_STRATEGY: 'hashids',
    });
    expect(result.success).toBe(false);
  });

  it('passes when strategy is hashids and salt is provided', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      SHORT_CODE_STRATEGY: 'hashids',
      SHORT_CODE_HASHIDS_SALT: 'a'.repeat(16),
    });
    expect(result.success).toBe(true);
  });

  it('rejects SHORT_CODE_LENGTH outside 4-16', () => {
    const result = envSchema.safeParse({ ...validEnv, SHORT_CODE_LENGTH: 2 });
    expect(result.success).toBe(false);
  });

  it('rejects SHORT_CODE_SNOWFLAKE_WORKER_ID outside 0-1023', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      SHORT_CODE_SNOWFLAKE_WORKER_ID: 2000,
    });
    expect(result.success).toBe(false);
  });
});
