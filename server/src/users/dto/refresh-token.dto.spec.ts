import { refreshTokenSchema } from './refresh-token.dto';

describe('refreshTokenSchema', () => {
  it('validates a valid refresh token', () => {
    const result = refreshTokenSchema.parse({
      refreshToken: 'valid-token-123',
    });
    expect(result.refreshToken).toBe('valid-token-123');
  });

  it('rejects empty refresh token', () => {
    expect(() => refreshTokenSchema.parse({ refreshToken: '' })).toThrow();
  });
});
