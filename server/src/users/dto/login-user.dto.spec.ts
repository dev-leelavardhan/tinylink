import { loginUserSchema } from './login-user.dto';

describe('loginUserSchema', () => {
  it('validates a valid login', () => {
    const result = loginUserSchema.parse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.email).toBe('test@example.com');
    expect(result.password).toBe('password123');
  });

  it('rejects invalid email', () => {
    expect(() =>
      loginUserSchema.parse({ email: 'invalid', password: 'password123' }),
    ).toThrow();
  });

  it('rejects empty password', () => {
    expect(() =>
      loginUserSchema.parse({ email: 'test@example.com', password: '' }),
    ).toThrow();
  });
});
